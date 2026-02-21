import { absoluteUrl, stripHtmlEntities, uniqueBy } from "../utils.js";
import type { ChapterContent, ChapterRef, ParserPreviewLink, PreviewResponse, StoryMetadata, StoryParser } from "../types.js";

export class BaseParser implements StoryParser {
  id = "base";

  canHandle(_url: string): boolean {
    return false;
  }

  async preview(_url: string): Promise<PreviewResponse> {
    throw new Error("Not implemented");
  }

  async fetchChapter(_chapterUrl: string): Promise<ChapterContent> {
    throw new Error("Not implemented");
  }

  protected normalizeChapterList(baseUrl: string, links: ParserPreviewLink[]): ChapterRef[] {
    const chapters = links
      .map((link, index) => {
        const sourceUrl = absoluteUrl(baseUrl, link.href);
        if (!sourceUrl) {
          return null;
        }
        return {
          id: `ch-${index + 1}`,
          sourceUrl,
          title: stripHtmlEntities(link.title || link.text || sourceUrl),
        };
      })
      .filter((value): value is ChapterRef => value !== null);

    return uniqueBy(chapters, (chapter) => chapter.sourceUrl).map((chapter, index) => ({
      ...chapter,
      id: `ch-${index + 1}`,
    }));
  }

  protected metadataDefaults(
    sourceUrl: string,
    title: string,
    author: string,
    description: string | null = null,
    coverImageUrl: string | null = null
  ): StoryMetadata {
    return {
      sourceUrl,
      title: stripHtmlEntities(title) || "Untitled",
      author: stripHtmlEntities(author) || "Unknown",
      language: "en",
      description: description ? stripHtmlEntities(description) : null,
      coverImageUrl,
    };
  }
}
