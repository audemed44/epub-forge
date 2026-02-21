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

    const container = $("div.portlet-body").has("div.chapter-inner").first();
    const content = container.length ? container : $(".page-content-wrapper").first();

    content.find("script, style, nav, .btn, .chapter-nav").remove();
    content.find("a[href*='royalroadl.com'], a[href*='royalroad.com']").filter((_i, el) => {
      const txt = ($(el).text() || "").toLowerCase();
      return txt.includes("next") || txt.includes("previous");
    }).remove();

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }
}
