export type Metadata = {
  sourceUrl: string;
  title: string;
  author: string;
  language: string;
  description: string | null;
  coverImageUrl: string | null;
  fileName: string | null;
};

export type ChapterRef = {
  id: string;
  sourceUrl: string;
  title: string;
};

export type PreviewResponse = {
  parserId: string;
  metadata: {
    sourceUrl: string;
    title: string;
    author: string;
    language: string;
    description: string | null;
    coverImageUrl: string | null;
  };
  chapters: ChapterRef[];
};

export type QueueJob = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: {
    stage: string;
    completed: number;
    total: number;
  };
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  hasResult: boolean;
  title: string | null;
  fileName: string | null;
  totalChapters: number;
  movedToBookdrop: boolean;
  bookdropPath: string | null;
};

export type QueueListResponse = { jobs: QueueJob[] };

export type BuildJobStatus = QueueJob & { logs: string[] };
