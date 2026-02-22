import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildFromSelection, type BuildFromSelectionInput } from "@epub-forge/core";
import { moveFile, resolveUniqueFilePath, safeAsciiFilename } from "../lib/storage.js";
import { JobsRepository } from "./repository.js";
import type { BuildJob, BuildJobRequest } from "../types.js";

type QueueServiceOptions = {
  outputDir: string;
  bookdropDir: string;
  repository: JobsRepository;
};

export class BuildQueueService {
  private readonly jobs = new Map<string, BuildJob>();
  private readonly queue: string[] = [];
  private workerRunning = false;

  constructor(private readonly options: QueueServiceOptions) {}

  async restore(): Promise<void> {
    const restored = await this.options.repository.loadActive();
    for (const item of restored) {
      const job: BuildJob = {
        ...item,
        logs: Array.isArray(item.logs) ? item.logs : [],
        movedToBookdrop: !!item.movedToBookdrop,
        bookdropPath: item.bookdropPath || null,
        resultPath: item.resultPath || null,
        archived: !!item.archived,
      };

      if (job.status === "running") {
        job.status = "queued";
        job.logs.push(`${new Date().toISOString()} Server restarted; re-queued job`);
      }

      this.jobs.set(job.id, job);
      if (job.status === "queued") {
        this.queue.push(job.id);
      }
    }
  }

  list(): BuildJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async listArchived(): Promise<BuildJob[]> {
    return this.options.repository.loadArchived();
  }

  get(jobId: string): BuildJob | null {
    return this.jobs.get(jobId) || null;
  }

  async getAny(jobId: string): Promise<BuildJob | null> {
    return this.jobs.get(jobId) || this.options.repository.getById(jobId);
  }

  async checkDuplicateTargetName(preferredFileName: string | null | undefined): Promise<{
    normalizedFileName: string;
    inQueue: boolean;
    onDisk: boolean;
  }> {
    const normalizedFileName = safeAsciiFilename(preferredFileName || "book.epub");

    const inQueue = [...this.jobs.values()].some((job) => {
      const queuedName = safeAsciiFilename(job.request.metadata.fileName || job.request.metadata.title || "book.epub");
      return queuedName === normalizedFileName;
    });

    const targetPath = path.join(this.options.outputDir, normalizedFileName);
    const onDisk = await fileExists(targetPath);

    return { normalizedFileName, inQueue, onDisk };
  }

  async enqueue(request: BuildJobRequest): Promise<BuildJob> {
    const jobId = randomUUID();
    const job: BuildJob = {
      id: jobId,
      status: "queued",
      progress: { stage: "queued", completed: 0, total: request.chapterUrls?.length || 0 },
      logs: [],
      request,
      createdAt: Date.now(),
      finishedAt: null,
      error: null,
      resultPath: null,
      movedToBookdrop: false,
      bookdropPath: null,
      archived: false,
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    await this.persist();
    void this.processQueue();
    return job;
  }

  async clearAll(): Promise<void> {
    const hasRunningJob = [...this.jobs.values()].some((job) => job.status === "running");
    if (hasRunningJob) {
      throw new Error("cannot clear queue while a build is running");
    }

    const ids = [...this.jobs.values()].map((job) => job.id);
    await this.options.repository.archive(ids);
    this.queue.length = 0;
    this.jobs.clear();
    await fsp.rm(this.options.outputDir, { recursive: true, force: true });
    await fsp.mkdir(this.options.outputDir, { recursive: true });
  }

  async moveToBookdrop(jobId: string): Promise<{ movedToBookdrop: boolean; bookdropPath: string | null }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error("job not found");
    }
    if (job.status !== "done" || !job.resultPath) {
      throw new Error("job not complete");
    }
    if (job.movedToBookdrop) {
      return { movedToBookdrop: true, bookdropPath: job.bookdropPath };
    }

    const destPath = await resolveUniqueFilePath(this.options.bookdropDir, path.basename(job.resultPath));
    await moveFile(job.resultPath, destPath);
    job.resultPath = null;
    job.movedToBookdrop = true;
    job.bookdropPath = destPath;
    job.logs.push(`${new Date().toISOString()} Moved to bookdrop: ${destPath}`);
    await this.persist();
    return { movedToBookdrop: true, bookdropPath: destPath };
  }

  private async persist(): Promise<void> {
    await this.options.repository.save([...this.jobs.values()]);
  }

  async processQueue(): Promise<void> {
    if (this.workerRunning) {
      return;
    }
    this.workerRunning = true;

    try {
      while (this.queue.length > 0) {
        const nextJobId = this.queue.shift();
        if (!nextJobId) {
          continue;
        }
        const job = this.jobs.get(nextJobId);
        if (!job || job.status !== "queued") {
          continue;
        }

        const { url, parserId, metadata, chapterUrls, chapterTitles } = job.request;
        job.status = "running";
        job.logs.push(`${new Date().toISOString()} Job started`);
        await this.persist();

        try {
          const buildInput: BuildFromSelectionInput = { url, metadata };
          if (parserId !== undefined) {
            buildInput.parserId = parserId;
          }
          if (chapterUrls !== undefined) {
            buildInput.chapterUrls = chapterUrls;
          }
          const built = await buildFromSelection(buildInput, {
            onProgress: (progress) => {
              job.progress = progress;
            },
            onLog: (message) => {
              const enrichedMessage = enrichChapterLogMessage(message, chapterTitles);
              job.logs.push(`${new Date().toISOString()} ${enrichedMessage}`);
              if (job.logs.length > 400) {
                job.logs.shift();
              }
            },
          });

          const filePath = await resolveUniqueFilePath(this.options.outputDir, built.filename);
          await fsp.writeFile(filePath, built.epubBuffer);

          job.status = "done";
          job.resultPath = filePath;
          job.finishedAt = Date.now();
          job.logs.push(`${new Date().toISOString()} Job finished`);
          await this.persist();
        } catch (error) {
          job.status = "error";
          job.error = error instanceof Error ? error.message : "Build failed";
          job.finishedAt = Date.now();
          job.logs.push(`${new Date().toISOString()} Job failed: ${job.error}`);
          await this.persist();
        }
      }
    } finally {
      this.workerRunning = false;
    }
  }
}

function enrichChapterLogMessage(message: string, chapterTitles?: string[]): string {
  if (!Array.isArray(chapterTitles) || chapterTitles.length === 0) {
    return message;
  }

  const match = /^Fetching chapter\s+(\d+)\/\d+/i.exec(message);
  if (!match) {
    return message;
  }

  const chapterNumber = Number(match[1]);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return message;
  }

  const chapterTitle = chapterTitles[chapterNumber - 1];
  if (!chapterTitle) {
    return message;
  }

  return `${message}: ${chapterTitle}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
