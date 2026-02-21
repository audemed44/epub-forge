import { BaseParser } from "./baseParser.js";
import { fetchDom } from "../http.js";
import { stripHtmlEntities } from "../utils.js";

export class WordpressGenericParser extends BaseParser {
  id = "wordpress-generic";

  canHandle(url) {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("wordpress") || host.endsWith(".blog") || host.endsWith(".com");
  }

  contentSelector() {
    return "div.entry-content, div.post-content, ul.wp-block-post-template, .wp-block-cover__inner-container";
  }

  titleSelector() {
    return ".entry-title, .page-title, header.post-title h1, .post-title, #chapter-heading, .wp-block-post-title, h1";
  }

  async preview(url) {
    const { $ } = await fetchDom(url);
    const title = $(this.titleSelector()).first().text().trim() || $("title").text().trim();
    const author = $("[rel='author'], .author a, .byline a").first().text().trim() || "Unknown";
    const description = $("meta[name='description']").attr("content") || null;
    const coverImageUrl = $("meta[property='og:image']").attr("content") || null;

    const content = $(this.contentSelector()).first();
    const baseHost = new URL(url).hostname;
    const links = [];
    content.find("a[href]").each((_i, el) => {
      const href = $(el).attr("href");
      const text = stripHtmlEntities($(el).text());
      if (!href || !text) {
        return;
      }
      try {
        const absolute = new URL(href, url);
        const looksLikeChapter = /chapter|prologue|epilogue|part\s+\d+/i.test(text) || /chapter|prologue|epilogue/i.test(absolute.pathname);
        if (absolute.hostname === baseHost && looksLikeChapter) {
          links.push({ href: absolute.toString(), text });
        }
      } catch {
        // ignore invalid URLs
      }
    });

    let chapters = this.normalizeChapterList(url, links);
    if (chapters.length === 0) {
      chapters = [{ id: "ch-1", sourceUrl: url, title: title || "Chapter 1" }];
    }

    return {
      parserId: this.id,
      metadata: this.metadataDefaults(url, title, author, description, coverImageUrl),
      chapters,
    };
  }

  async fetchChapter(chapterUrl) {
    const { $ } = await fetchDom(chapterUrl);
    const title = $(this.titleSelector()).first().text().trim() || $("title").text().trim() || "Chapter";
    const content = $(this.contentSelector()).first();
    content.find("script, style, nav, .sharedaddy, .jp-relatedposts").remove();

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }
}
