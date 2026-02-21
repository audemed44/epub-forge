import { absoluteUrl, stripHtmlEntities, uniqueBy } from "../utils.js";

export class BaseParser {
  id = "base";

  canHandle(_url) {
    return false;
  }

  async preview(_url) {
    throw new Error("Not implemented");
  }

  async fetchChapter(_chapterUrl) {
    throw new Error("Not implemented");
  }

  normalizeChapterList(baseUrl, links) {
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
      .filter(Boolean);

    return uniqueBy(chapters, (chapter) => chapter.sourceUrl)
      .map((chapter, index) => ({ ...chapter, id: `ch-${index + 1}` }));
  }

  metadataDefaults(sourceUrl, title, author, description = null, coverImageUrl = null) {
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
