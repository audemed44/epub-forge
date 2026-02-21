import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
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

const buildJobs = new Map();
const buildQueue = [];
let buildWorkerRunning = false;

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
  const payload = {
    jobs: [...buildJobs.values()].map((job) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      logs: job.logs,
      request: job.request,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      error: job.error,
      resultPath: job.resultPath,
      movedToBookdrop: !!job.movedToBookdrop,
      bookdropPath: job.bookdropPath || null,
    })),
  };

  await fsp.writeFile(jobsFile, JSON.stringify(payload, null, 2), "utf8");
}

async function restoreJobs() {
  try {
    const raw = await fsp.readFile(jobsFile, "utf8");
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
      };

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
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
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
    const { url, parserId = null, metadata, chapterUrls = [] } = req.body || {};
    if (!url || !metadata) {
      return res.status(400).json({ error: "url and metadata are required" });
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

app.delete("/api/build-jobs", async (_req, res) => {
  const hasRunningJob = [...buildJobs.values()].some((job) => job.status === "running");
  if (hasRunningJob) {
    return res.status(409).json({ error: "cannot clear queue while a build is running" });
  }

  try {
    buildQueue.length = 0;
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
