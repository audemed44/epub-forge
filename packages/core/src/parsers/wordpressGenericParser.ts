import { BaseParser } from "./baseParser.js";
import { fetchDom } from "../http.js";
import { stripHtmlEntities } from "../utils.js";

export class WordpressGenericParser extends BaseParser {
  override id = "wordpress-generic";

  override canHandle(url: string): boolean {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("wordpress") || host.endsWith(".blog");
  }

  private contentSelector(): string {
    return "div.entry-content, div.post-content, ul.wp-block-post-template, .wp-block-cover__inner-container";
  }

  private titleSelector(): string {
    return ".entry-title, .page-title, header.post-title h1, .post-title, #chapter-heading, .wp-block-post-title, h1";
  }

  override async preview(url: string) {
    const { $ } = await fetchDom(url);
    const title = $(this.titleSelector()).first().text().trim() || $("title").text().trim();
    const author = $("[rel='author'], .author a, .byline a").first().text().trim() || "Unknown";
    const description = $("meta[name='description']").attr("content") || null;
    const coverImageUrl = $("meta[property='og:image']").attr("content") || null;

    const content = $(this.contentSelector()).first();
    if (!content.length || !title) {
      throw new Error("Could not detect a supported WordPress chapter page");
    }
    const baseHost = new URL(url).hostname;
    const links: { href: string; text: string }[] = [];
    content.find("a[href]").each((_i: number, el: any) => {
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

  override async fetchChapter(chapterUrl: string) {
    const { $ } = await fetchDom(chapterUrl);
    const title = $(this.titleSelector()).first().text().trim() || $("title").text().trim() || "Chapter";
    const content = $(this.contentSelector()).first();
    if (!content.length) {
      throw new Error("Could not detect chapter content for this page");
    }
    content.find("script, style, nav, .sharedaddy, .jp-relatedposts").remove();
    content.find("a[rel='next'], a[rel='prev']").remove();
    content
      .find("a")
      .filter((_i: number, element: any) => {
        const text = ($(element).text() || "").toLowerCase();
        return text.includes("next chapter") || text.includes("previous chapter");
      })
      .remove();

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }
}
