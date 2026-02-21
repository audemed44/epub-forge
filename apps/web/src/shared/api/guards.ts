import type { BuildJobStatus, PreviewResponse, QueueListResponse } from "../types/api";

export function isPreviewResponse(value: unknown): value is PreviewResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.parserId === "string" && Array.isArray(record.chapters) && typeof record.metadata === "object";
}

export function isQueueListResponse(value: unknown): value is QueueListResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.jobs);
}

export function isBuildJobStatus(value: unknown): value is BuildJobStatus {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.status === "string" && Array.isArray(record.logs);
}
