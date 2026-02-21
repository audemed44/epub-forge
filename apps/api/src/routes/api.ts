import path from "node:path";
import { Router } from "express";
import { buildFromSelection, listParsers, previewUrl } from "@epub-forge/core";
import { safeAsciiFilename } from "../lib/storage.js";
import { toPublicJob } from "../jobs/presenter.js";
import type { BuildQueueService } from "../jobs/queueService.js";

type BuildRoutePayload = {
  url?: string;
  parserId?: string | null;
  metadata?: {
    sourceUrl: string;
    title: string;
    author: string;
    language: string;
    description: string | null;
    coverImageUrl: string | null;
    fileName?: string | null;
  };
  chapterUrls?: string[];
};

export function createApiRouter(queue: BuildQueueService) {
  const router = Router();

  router.get("/health", (_req: any, res: any) => {
    res.json({ ok: true, parsers: listParsers() });
  });

  router.post("/preview", async (req: any, res: any) => {
    try {
      const { url, parserId = null } = (req.body || {}) as { url?: string; parserId?: string | null };
      if (!url) {
        return res.status(400).json({ error: "url is required" });
      }

      const preview = await previewUrl(url, parserId);
      return res.json(preview);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Preview failed" });
    }
  });

  router.post("/build", async (req: any, res: any) => {
    try {
      const { url, parserId = null, metadata, chapterUrls = [] } = (req.body || {}) as BuildRoutePayload;
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
      return res.status(400).json({ error: error instanceof Error ? error.message : "Build failed" });
    }
  });

  router.post("/build-jobs", async (req: any, res: any) => {
    try {
      const { url, parserId = null, metadata, chapterUrls = [] } = (req.body || {}) as BuildRoutePayload;
      if (!url || !metadata) {
        return res.status(400).json({ error: "url and metadata are required" });
      }
      const job = await queue.enqueue({ url, parserId, metadata, chapterUrls });
      return res.json({ jobId: job.id });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to enqueue build" });
    }
  });

  router.get("/build-jobs", async (req: any, res: any) => {
    const scope = String(req.query?.scope || "active");
    const sourceJobs = scope === "archive" ? await queue.listArchived() : queue.list();
    const jobs = sourceJobs.map((job) => toPublicJob(job));
    return res.json({ jobs });
  });

  router.delete("/build-jobs", async (_req: any, res: any) => {
    try {
      await queue.clearAll();
      return res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to clear queue";
      const status = message.includes("cannot clear queue") ? 409 : 500;
      return res.status(status).json({ error: message });
    }
  });

  router.get("/build-jobs/:jobId", async (req: any, res: any) => {
    const job = await queue.getAny(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "job not found" });
    }
    return res.json(toPublicJob(job, true));
  });

  router.get("/build-jobs/:jobId/file", (req: any, res: any) => {
    const job = queue.get(req.params.jobId);
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

  router.post("/build-jobs/:jobId/move-to-bookdrop", async (req: any, res: any) => {
    const job = queue.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "job not found" });
    }
    if (job.status !== "done" || !job.resultPath) {
      return res.status(409).json({ error: "job not complete" });
    }

    try {
      const result = await queue.moveToBookdrop(job.id);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Move to bookdrop failed" });
    }
  });

  return router;
}
