import type { BuildJob, PublicJob } from "../types.js";

export function toPublicJob(job: BuildJob, includeLogs = false): PublicJob {
  const base: PublicJob = {
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
