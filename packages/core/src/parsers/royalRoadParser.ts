import type { CheerioAPI } from "cheerio";
import { BaseParser } from "./baseParser.js";
import { fetchDom } from "../http.js";
import { stripHtmlEntities } from "../utils.js";

export class RoyalRoadParser extends BaseParser {
  override id = "royalroad";

  override canHandle(url: string): boolean {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "royalroad.com" || host === "royalroadl.com";
  }

  private storyUrl(url: string): string {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const fictionIndex = parts.indexOf("fiction");
    if (fictionIndex >= 0 && parts.length >= fictionIndex + 2) {
      return `${parsed.origin}/fiction/${parts[fictionIndex + 1]}/${parts[fictionIndex + 2] || ""}`.replace(/\/$/, "");
    }
    return url.replace(/\/$/, "");
  }

  override async preview(url: string) {
    const sourceUrl = this.storyUrl(url);
    const { $ } = await fetchDom(sourceUrl);

    const title = $("div.fic-header div.col h1").first().text().trim() || $("h1").first().text().trim();
    const author = $("div.fic-header h4 span a").first().text().trim() || "Unknown";
    const description = $("div.fiction-info div.description").first().text().trim() || null;
    const coverImageUrl = $("img.thumbnail").first().attr("src") || null;

    const toc = await fetchDom(sourceUrl);
    const links: { href: string | undefined; text: string }[] = [];
    toc.$("table#chapters a[href*='/chapter/']").each((_i, el) => {
      links.push({
        href: toc.$(el).attr("href"),
        text: stripHtmlEntities(toc.$(el).text()),
      });
    });

    const chapters = this.normalizeChapterList(sourceUrl, links);
    return {
      parserId: this.id,
      metadata: this.metadataDefaults(sourceUrl, title, author, description, coverImageUrl),
      chapters,
    };
  }

  override async fetchChapter(chapterUrl: string) {
    const { $ } = await fetchDom(chapterUrl);
    const title = $("h1").first().text().trim() || $("h2").first().text().trim() || "Chapter";

    this.preprocessRawDom($);
    const container = $("div.portlet-body").has("div.chapter-inner").first();
    const content = container.length ? container : $(".page-content-wrapper").first();

    content.find("script, style, nav, .btn, .chapter-nav").remove();
    content
      .find("a[href*='royalroadl.com'], a[href*='royalroad.com']")
      .filter((_i, el) => {
        const txt = ($(el).text() || "").toLowerCase();
        return txt.includes("next") || txt.includes("previous");
      })
      .remove();
    this.removeAdvertisementBlocks($, content);
    this.keepOnlyWantedTopLevelElements($, content);
    this.removeProblematicInlineStyles($, content);

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }

  private removeProblematicInlineStyles($: CheerioAPI, content: any): void {
    content.find("[style]").each((_i: number, element: any) => {
      const styleValue = ($(element).attr("style") || "")
        .replace(/border(-left|-right|-inline-start|-inline-end)?\s*:[^;]+;?/gi, "")
        .replace(/outline\s*:[^;]+;?/gi, "")
        .replace(/box-shadow\s*:[^;]+;?/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      if (styleValue.length === 0) {
        $(element).removeAttr("style");
      } else {
        $(element).attr("style", styleValue);
      }
    });
  }

  private removeAdvertisementBlocks($: CheerioAPI, content: any): void {
    const isAdPortlet = (_i: number, element: any): boolean => {
      const el = $(element);
      const text = el.text().trim().toLowerCase();
      if (text === "advertisement" || text.startsWith("advertisement")) {
        return true;
      }
      return el.find("[id^='Chapter_'], [id^='chapter_']").length > 0;
    };

    content
      .find("div.portlet")
      .filter(isAdPortlet)
      .each((_i: number, element: any) => {
        const el = $(element);
        const prev = el.prev();
        if (prev.is("hr")) {
          prev.remove();
        }
        const next = el.next();
        if (next.is("hr")) {
          next.remove();
        }
        el.remove();
      });
  }

  private preprocessRawDom($: CheerioAPI): void {
    $("img").each((_i: number, element: any) => {
      const src = ($(element).attr("src") || "").trim();
      if (!src) {
        $(element).remove();
      }
    });

    $("p").each((_i: number, element: any) => {
      const classes = ($(element).attr("class") || "").split(/\s+/).filter(Boolean);
      const kept = classes.filter((name) => !/^cn[A-Z][A-Za-z0-9]{41}$/.test(name));
      if (kept.length === 0) {
        $(element).removeAttr("class");
      } else {
        $(element).attr("class", kept.join(" "));
      }
    });
  }

  private keepOnlyWantedTopLevelElements($: CheerioAPI, content: any): void {
    content.children().each((_i: number, element: any) => {
      if (!this.isWantedElement($, element)) {
        $(element).remove();
      }
    });
  }

  private isWantedElement($: CheerioAPI, element: any): boolean {
    const tag = element.tagName?.toLowerCase() || "";
    const className = ($(element).attr("class") || "").trim();
    return (
      tag === "h1" ||
      (tag === "div" &&
        (className.startsWith("chapter-inner") || className.includes("author-note-portlet") || className.includes("page-content")))
    );
  }
}
