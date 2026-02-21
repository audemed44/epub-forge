export type StoryMetadata = {
  sourceUrl: string;
  title: string;
  author: string;
  language: string;
  description: string | null;
  coverImageUrl: string | null;
  fileName?: string | null;
};

export type ChapterRef = {
  id: string;
  sourceUrl: string;
  title: string;
};

export type ChapterContent = {
  sourceUrl: string;
  title: string;
  contentHtml: string;
};

export type PreviewResponse = {
  parserId: string;
  metadata: StoryMetadata;
  chapters: ChapterRef[];
};

export type BuildProgress = {
  stage: string;
  completed: number;
  total: number;
};

export type BuildCallbacks = {
  onProgress?: (progress: BuildProgress) => void;
  onLog?: (message: string) => void;
};

export type BuildFromSelectionInput = {
  url: string;
  parserId?: string | null;
  metadata: StoryMetadata;
  chapterUrls?: string[];
};

export type BuildResult = {
  epubBuffer: Buffer;
  filename: string;
  chapterCount: number;
};

export type ParserPreviewLink = {
  href: string | undefined;
  title?: string;
  text?: string;
};

export interface StoryParser {
  id: string;
  canHandle(url: string): boolean;
  preview(url: string): Promise<PreviewResponse>;
  fetchChapter(chapterUrl: string): Promise<ChapterContent>;
}
