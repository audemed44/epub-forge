import { BaseParser } from "./baseParser.js";
import { fetchDom } from "../http.js";
import { absoluteUrl, stripHtmlEntities } from "../utils.js";

export class RoyalRoadParser extends BaseParser {
  id = "royalroad";

  canHandle(url) {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "royalroad.com" || host === "royalroadl.com";
  }

  storyUrl(url) {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const fictionIndex = parts.indexOf("fiction");
    if (fictionIndex >= 0 && parts.length >= fictionIndex + 2) {
      return `${parsed.origin}/fiction/${parts[fictionIndex + 1]}/${parts[fictionIndex + 2] || ""}`.replace(/\/$/, "");
    }
    return url.replace(/\/$/, "");
  }

  async preview(url) {
    const sourceUrl = this.storyUrl(url);
    const { $ } = await fetchDom(sourceUrl);

    const title = $("div.fic-header div.col h1").first().text().trim() || $("h1").first().text().trim();
    const author = $("div.fic-header h4 span a").first().text().trim() || "Unknown";
    const description = $("div.fiction-info div.description").first().text().trim() || null;
    const coverImageUrl = $("img.thumbnail").first().attr("src") || null;

    const tocUrl = sourceUrl;
    const toc = await fetchDom(tocUrl);
    const links = [];
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

  async fetchChapter(chapterUrl) {
    const { $ } = await fetchDom(chapterUrl);
    const title = $("h1").first().text().trim() || $("h2").first().text().trim() || "Chapter";

    this.preprocessRawDom($);
    const container = $("div.portlet-body").has("div.chapter-inner").first();
    const content = container.length ? container : $(".page-content-wrapper").first();

    content.find("script, style, nav, .btn, .chapter-nav").remove();
    content.find("a[href*='royalroadl.com'], a[href*='royalroad.com']").filter((_i, el) => {
      const txt = ($(el).text() || "").toLowerCase();
      return txt.includes("next") || txt.includes("previous");
    }).remove();
    this.removeAdvertisementBlocks($, content);
    this.keepOnlyWantedTopLevelElements($, content);
    this.removeProblematicInlineStyles($, content);

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }

  removeProblematicInlineStyles($, content) {
    content.find("[style]").each((_i, element) => {
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

  removeAdvertisementBlocks($, content) {
    const isAdPortlet = (_i, element) => {
      const el = $(element);
      const text = el.text().trim().toLowerCase();
      if (text === "advertisement" || text.startsWith("advertisement")) {
        return true;
      }
      if (el.find("[id^='Chapter_'], [id^='chapter_']").length > 0) {
        return true;
      }
      return false;
    };

    content.find("div.portlet").filter(isAdPortlet).each((_i, element) => {
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

  preprocessRawDom($) {
    $("img").each((_i, element) => {
      const src = ($(element).attr("src") || "").trim();
      if (!src) {
        $(element).remove();
      }
    });

    $("p").each((_i, element) => {
      const classes = ($(element).attr("class") || "").split(/\s+/).filter(Boolean);
      const kept = classes.filter((name) => !/^cn[A-Z][A-Za-z0-9]{41}$/.test(name));
      if (kept.length === 0) {
        $(element).removeAttr("class");
      } else {
        $(element).attr("class", kept.join(" "));
      }
    });
  }

  keepOnlyWantedTopLevelElements($, content) {
    content.children().each((_i, element) => {
      if (!this.isWantedElement($, element)) {
        $(element).remove();
      }
    });
  }

  isWantedElement($, element) {
    const tag = element.tagName?.toLowerCase() || "";
    const className = ($(element).attr("class") || "").trim();
    return (
      tag === "h1" ||
      (tag === "div" &&
        (className.startsWith("chapter-inner") || className.includes("author-note-portlet") || className.includes("page-content")))
    );
  }
}
