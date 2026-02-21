import type { BuildFromSelectionInput, BuildProgress } from "@epub-forge/core";

export type BuildJobStatus = "queued" | "running" | "done" | "error";

export type BuildJob = {
  id: string;
  status: BuildJobStatus;
  progress: BuildProgress;
  logs: string[];
  request: BuildFromSelectionInput;
  createdAt: number;
  finishedAt: number | null;
  error: string | null;
  resultPath: string | null;
  movedToBookdrop: boolean;
  bookdropPath: string | null;
};

export type PublicJob = {
  id: string;
  status: BuildJobStatus;
  progress: BuildProgress;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  hasResult: boolean;
  title: string | null;
  fileName: string | null;
  totalChapters: number;
  movedToBookdrop: boolean;
  resultPath: string | null;
  bookdropPath: string | null;
  logs?: string[];
};

export type ApiError = { error: string };
