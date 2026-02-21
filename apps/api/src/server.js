import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { buildFromSelection, listParsers, previewUrl } from "@scraper-epub/core";

const app = express();
const port = process.env.PORT || 3000;

function resolveDataRoot() {
  if (process.env.DATA_ROOT) {
    return process.env.DATA_ROOT;
  }
  if (fs.existsSync("/.dockerenv")) {
    return "/data";
  }
  return path.join(process.cwd(), ".data");
}

const dataRoot = resolveDataRoot();
const outputDir = process.env.EPUB_OUTPUT_DIR || path.join(dataRoot, "epubs");
const bookdropDir = process.env.BOOKDROP_DIR || path.join(dataRoot, "bookdrop");
const configDir = process.env.CONFIG_DIR || path.join(dataRoot, "config");
const jobsFile = path.join(configDir, "jobs.json");
const jobsDbPath = path.join(configDir, "jobs.sqlite");

const buildJobs = new Map();
const buildQueue = [];
let buildWorkerRunning = false;
let jobsDb;

function safeAsciiFilename(filename) {
  const cleaned = (filename || "book.epub")
    .replace(/[\r\n"]/g, " ")
    .replace(/[\/\\:*?<>|]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "book.epub";
  }

  const withExtension = cleaned.toLowerCase().endsWith(".epub") ? cleaned : `${cleaned}.epub`;
  return withExtension.replace(/^\.+/, "").replace(/\.+$/, "") || "book.epub";
}

function normalizeRequestedFilename(filename) {
  if (typeof filename !== "string") {
    return null;
  }
  const trimmed = filename.trim();
  if (!trimmed) {
    return null;
  }
  return safeAsciiFilename(trimmed).toLowerCase();
}

function hasDuplicateFilename(filename) {
  const normalized = normalizeRequestedFilename(filename);
  if (!normalized) {
    return false;
  }

  const duplicateInMemory = [...buildJobs.values()].some((job) => {
    const jobFilename = normalizeRequestedFilename(job.request?.metadata?.fileName);
    return jobFilename === normalized;
  });
  if (duplicateInMemory) {
    return true;
  }

  const row = jobsDb
    .prepare(
      `
        SELECT id
        FROM jobs
        WHERE cleared != 1
          AND lower(json_extract(request_json, '$.metadata.fileName')) = ?
        LIMIT 1
      `
    )
    .get(normalized);

  return !!row;
}

async function resolveUniqueFilePath(directory, preferredFilename) {
  const safeName = safeAsciiFilename(preferredFilename);
  const parsed = path.parse(safeName);
  const baseName = parsed.name || "book";
  const extension = parsed.ext || ".epub";

  let candidate = path.join(directory, `${baseName}${extension}`);
  let counter = 2;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = path.join(directory, `${baseName} (${counter})${extension}`);
      counter += 1;
    } catch (error) {
      if (error.code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }
}

async function ensureStoragePaths() {
  await fsp.mkdir(outputDir, { recursive: true });
  await fsp.mkdir(bookdropDir, { recursive: true });
  await fsp.mkdir(configDir, { recursive: true });
}

function openJobsDb() {
  jobsDb = new DatabaseSync(jobsDbPath);
  jobsDb.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      progress_json TEXT NOT NULL,
      logs_json TEXT NOT NULL,
      request_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      error TEXT,
      result_path TEXT,
      moved_to_bookdrop INTEGER NOT NULL DEFAULT 0,
      bookdrop_path TEXT,
      cleared INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function rowToJob(row) {
  return {
    id: row.id,
    status: row.status,
    progress: JSON.parse(row.progress_json),
    logs: JSON.parse(row.logs_json),
    request: JSON.parse(row.request_json),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    error: row.error,
    resultPath: row.result_path || null,
    movedToBookdrop: !!row.moved_to_bookdrop,
    bookdropPath: row.bookdrop_path || null,
    cleared: !!row.cleared,
  };
}

async function moveFile(sourcePath, destinationPath) {
  try {
    await fsp.rename(sourcePath, destinationPath);
    return;
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }
  }

  await fsp.copyFile(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);

  try {
    await fsp.unlink(sourcePath);
  } catch (error) {
    await fsp.unlink(destinationPath).catch(() => {});
    throw error;
  }
}

function toPublicJob(job, includeLogs = false) {
  const base = {
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    hasResult: !!job.resultPath,
    title: job.request?.metadata?.title || null,
    fileName: job.request?.metadata?.fileName || null,
    totalChapters: job.request?.chapterUrls?.length || 0,
    movedToBookdrop: !!job.movedToBookdrop,
    resultPath: job.resultPath || null,
    bookdropPath: job.bookdropPath || null,
  };

  if (includeLogs) {
    return { ...base, logs: job.logs };
  }
  return base;
}

async function persistJobs() {
  const statement = jobsDb.prepare(`
    INSERT INTO jobs (
      id,
      status,
      progress_json,
      logs_json,
      request_json,
      created_at,
      finished_at,
      error,
      result_path,
      moved_to_bookdrop,
      bookdrop_path,
      cleared
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      progress_json = excluded.progress_json,
      logs_json = excluded.logs_json,
      request_json = excluded.request_json,
      created_at = excluded.created_at,
      finished_at = excluded.finished_at,
      error = excluded.error,
      result_path = excluded.result_path,
      moved_to_bookdrop = excluded.moved_to_bookdrop,
      bookdrop_path = excluded.bookdrop_path,
      cleared = excluded.cleared
  `);

  for (const job of buildJobs.values()) {
    statement.run(
      job.id,
      job.status,
      JSON.stringify(job.progress),
      JSON.stringify(job.logs),
      JSON.stringify(job.request),
      job.createdAt,
      job.finishedAt,
      job.error,
      job.resultPath,
      job.movedToBookdrop ? 1 : 0,
      job.bookdropPath,
      job.cleared ? 1 : 0
    );
  }
}

function importLegacyJobsFromJson() {
  if (!fs.existsSync(jobsFile)) {
    return;
  }

  const rowCount = jobsDb.prepare("SELECT COUNT(*) AS count FROM jobs").get().count;
  if (rowCount > 0) {
    return;
  }

  const raw = fs.readFileSync(jobsFile, "utf8");
  const payload = JSON.parse(raw);
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  for (const item of jobs) {
    const job = {
      id: item.id,
      status: item.status,
      progress: item.progress,
      logs: Array.isArray(item.logs) ? item.logs : [],
      request: item.request,
      createdAt: item.createdAt,
      finishedAt: item.finishedAt,
      error: item.error,
      resultPath: item.resultPath || null,
      movedToBookdrop: !!item.movedToBookdrop,
      bookdropPath: item.bookdropPath || null,
      cleared: false,
    };

    buildJobs.set(job.id, job);
  }
}

async function restoreJobs() {
  importLegacyJobsFromJson();

  if (buildJobs.size > 0) {
    await persistJobs();
    buildJobs.clear();
  }

  const rows = jobsDb.prepare("SELECT * FROM jobs WHERE cleared != 1 ORDER BY created_at ASC").all();
  for (const row of rows) {
    const job = rowToJob(row);

    if (job.status === "running") {
      // Crash-safe behavior: restart running jobs from queue.
      job.status = "queued";
      job.logs.push(`${new Date().toISOString()} Server restarted; re-queued job`);
    }

    buildJobs.set(job.id, job);
    if (job.status === "queued") {
      buildQueue.push(job.id);
    }
  }
}

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, parsers: listParsers() });
});

app.post("/api/preview", async (req, res) => {
  try {
    const { url, parserId = null } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }

    const preview = await previewUrl(url, parserId);
    return res.json(preview);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/build", async (req, res) => {
  try {
    const { url, parserId = null, metadata, chapterUrls = [] } = req.body || {};
    if (!url || !metadata) {
      return res.status(400).json({ error: "url and metadata are required" });
    }

    const built = await buildFromSelection({ url, parserId, metadata, chapterUrls });
    const asciiFilename = safeAsciiFilename(built.filename);
    const utf8Filename = encodeURIComponent((built.filename || "book.epub").replace(/[\r\n]/g, " "));
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
    return res.send(built.epubBuffer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/build-jobs", async (req, res) => {
  try {
    const { url, parserId = null, metadata, chapterUrls = [], forceDuplicate = false } = req.body || {};
    if (!url || !metadata) {
      return res.status(400).json({ error: "url and metadata are required" });
    }

    if (!forceDuplicate && hasDuplicateFilename(metadata.fileName)) {
      return res.status(409).json({ error: "A build with that file name already exists.", duplicateFilename: true });
    }


    const jobId = randomUUID();
    const job = {
      id: jobId,
      status: "queued",
      progress: { stage: "queued", completed: 0, total: chapterUrls.length || 0 },
      logs: [],
      request: {
        url,
        parserId,
        metadata,
        chapterUrls,
      },
      createdAt: Date.now(),
      finishedAt: null,
      error: null,
      resultPath: null,
      movedToBookdrop: false,
      bookdropPath: null,
      cleared: false,
    };

    buildJobs.set(jobId, job);
    buildQueue.push(jobId);
    await persistJobs();
    processBuildQueue().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
    });

    return res.json({ jobId });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/build-jobs", (_req, res) => {
  const jobs = [...buildJobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((job) => toPublicJob(job));
  return res.json({ jobs });
});

app.get("/api/build-jobs/name-exists", (req, res) => {
  const filename = typeof req.query.fileName === "string" ? req.query.fileName : "";
  return res.json({ exists: hasDuplicateFilename(filename) });
});


app.delete("/api/build-jobs", async (_req, res) => {
  const hasRunningJob = [...buildJobs.values()].some((job) => job.status === "running");
  if (hasRunningJob) {
    return res.status(409).json({ error: "cannot clear queue while a build is running" });
  }

  try {
    buildQueue.length = 0;
    const setCleared = jobsDb.prepare("UPDATE jobs SET cleared = 1 WHERE cleared != 1");
    setCleared.run();
    buildJobs.clear();
    await fsp.rm(outputDir, { recursive: true, force: true });
    await fsp.mkdir(outputDir, { recursive: true });
    await persistJobs();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/build-jobs/:jobId", (req, res) => {
  const job = buildJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job not found" });
  }

  return res.json(toPublicJob(job, true));
});

app.get("/api/build-jobs/:jobId/file", async (req, res) => {
  const job = buildJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job not found" });
  }
  if (job.status !== "done" || !job.resultPath) {
    return res.status(409).json({ error: "job not complete" });
  }

  try {
    const filename = path.basename(job.resultPath);
    const asciiFilename = safeAsciiFilename(filename);
    const utf8Filename = encodeURIComponent(filename.replace(/[\r\n]/g, " "));
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
    return res.sendFile(job.resultPath);
  } catch {
    return res.status(404).json({ error: "file not found" });
  }
});

app.post("/api/build-jobs/:jobId/move-to-bookdrop", async (req, res) => {
  const job = buildJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job not found" });
  }
  if (job.status !== "done" || !job.resultPath) {
    return res.status(409).json({ error: "job not complete" });
  }
  if (job.movedToBookdrop) {
    return res.json({ ok: true, movedToBookdrop: true, bookdropPath: job.bookdropPath });
  }

  try {
    const destPath = await resolveUniqueFilePath(bookdropDir, path.basename(job.resultPath));
    await moveFile(job.resultPath, destPath);
    job.resultPath = null;
    job.movedToBookdrop = true;
    job.bookdropPath = destPath;
    job.logs.push(`${new Date().toISOString()} Moved to bookdrop: ${destPath}`);
    await persistJobs();
    return res.json({ ok: true, movedToBookdrop: true, bookdropPath: destPath });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

async function processBuildQueue() {
  if (buildWorkerRunning) {
    return;
  }
  buildWorkerRunning = true;

  try {
    while (buildQueue.length > 0) {
      const nextJobId = buildQueue.shift();
      const job = buildJobs.get(nextJobId);
      if (!job || job.status !== "queued") {
        continue;
      }

      const { url, parserId, metadata, chapterUrls } = job.request;
      job.status = "running";
      job.logs.push(`${new Date().toISOString()} Job started`);
      await persistJobs();

      try {
        const built = await buildFromSelection(
          { url, parserId, metadata, chapterUrls },
          {
            onProgress: (progress) => {
              job.progress = progress;
            },
            onLog: (message) => {
              job.logs.push(`${new Date().toISOString()} ${message}`);
              if (job.logs.length > 400) {
                job.logs.shift();
              }
            },
          }
        );

        const filePath = await resolveUniqueFilePath(outputDir, built.filename);
        await fsp.writeFile(filePath, built.epubBuffer);

        job.status = "done";
        job.resultPath = filePath;
        job.finishedAt = Date.now();
        job.logs.push(`${new Date().toISOString()} Job finished`);
        await persistJobs();
      } catch (error) {
        job.status = "error";
        job.error = error.message;
        job.finishedAt = Date.now();
        job.logs.push(`${new Date().toISOString()} Job failed: ${error.message}`);
        await persistJobs();
      }
    }
  } finally {
    buildWorkerRunning = false;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const builtWebRoot = path.resolve(__dirname, "../../web/dist");
const legacyWebRoot = path.resolve(__dirname, "../../web/public");

async function start() {
  await ensureStoragePaths();
  openJobsDb();
  await restoreJobs();
  processBuildQueue().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  });

  if (process.env.ONE_PORT_DEV === "1") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.resolve(__dirname, "../../web"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const webRoot = fs.existsSync(builtWebRoot) ? builtWebRoot : legacyWebRoot;
    app.use(express.static(webRoot));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(webRoot, "index.html"));
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`scraper-epub listening on :${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
