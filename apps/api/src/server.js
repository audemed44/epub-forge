import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildFromSelection, listParsers, previewUrl } from "@scraper-epub/core";

const app = express();
const port = process.env.PORT || 3000;
const buildJobs = new Map();

function safeAsciiFilename(filename) {
  const cleaned = (filename || "book.epub")
    .replace(/[\r\n"]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "book.epub";
  }
  return cleaned.toLowerCase().endsWith(".epub") ? cleaned : `${cleaned}.epub`;
}

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`
    );
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
      createdAt: Date.now(),
      finishedAt: null,
      error: null,
      result: null,
    };
    buildJobs.set(jobId, job);

    setImmediate(async () => {
      job.status = "running";
      try {
        const built = await buildFromSelection(
          { url, parserId, metadata, chapterUrls },
          {
            onProgress: (progress) => {
              job.progress = progress;
            },
            onLog: (message) => {
              job.logs.push(`${new Date().toISOString()} ${message}`);
              if (job.logs.length > 200) {
                job.logs.shift();
              }
            },
          }
        );
        job.status = "done";
        job.result = built;
        job.finishedAt = Date.now();
      } catch (error) {
        job.status = "error";
        job.error = error.message;
        job.finishedAt = Date.now();
      }
    });

    return res.json({ jobId });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/build-jobs/:jobId", (req, res) => {
  const job = buildJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job not found" });
  }

  return res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    logs: job.logs,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    hasResult: !!job.result,
  });
});

app.get("/api/build-jobs/:jobId/file", (req, res) => {
  const job = buildJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "job not found" });
  }
  if (job.status !== "done" || !job.result) {
    return res.status(409).json({ error: "job not complete" });
  }

  const asciiFilename = safeAsciiFilename(job.result.filename);
  const utf8Filename = encodeURIComponent((job.result.filename || "book.epub").replace(/[\r\n]/g, " "));
  res.setHeader("Content-Type", "application/epub+zip");
  res.setHeader("Content-Disposition", `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
  return res.send(job.result.epubBuffer);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const builtWebRoot = path.resolve(__dirname, "../../web/dist");
const legacyWebRoot = path.resolve(__dirname, "../../web/public");

async function start() {
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
