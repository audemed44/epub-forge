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

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffMs = timestamp - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absSeconds < 60) {
    return formatter.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffMonths / 12);
  return formatter.format(diffYears, "year");
}

export function formatAbsoluteDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}
