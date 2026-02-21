import type { ChapterRef, QueueJob } from "../types/api";

export function sanitizeFilenameFromHeader(disposition: string | null): string {
  if (!disposition) {
    return "book.epub";
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // ignore decode failure
    }
  }

  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] ?? "book.epub";
}

export function chapterLabel(chapter: ChapterRef, index: number): string {
  return `${String(index + 1).padStart(4, "0")} - ${chapter.title}`;
}

export function basenameFromPath(input: string): string {
  return input.split(/[\\/]/).pop() || input;
}

export function formatStatus(job: QueueJob): string {
  if (job.status === "running") {
    return `${job.progress.completed}/${job.progress.total || job.totalChapters}`;
  }
  if (job.status === "queued") {
    return "Queued";
  }
  if (job.status === "done") {
    return "Completed";
  }
  return "Failed";
}
