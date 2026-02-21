import { BaseParser } from "./baseParser.js";
import { fetchDom, fetchJson } from "../http.js";
import { stripHtmlEntities } from "../utils.js";

export class NovelFireParser extends BaseParser {
  id = "novelfire";

  canHandle(url) {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "novelfire.net";
  }

  storyRoot(url) {
    return url.endsWith("/chapters") ? url.slice(0, -9) : url.replace(/\/$/, "");
  }

  async preview(url) {
    const root = this.storyRoot(url);
    const chapterListingUrl = `${root}/chapters`;
    const { $, html } = await fetchDom(chapterListingUrl);

    const title = $("div.novel-info h1").first().text().trim() || $("h1").first().text().trim();
    const author = $("span[itemprop='author']").first().text().trim() || "Unknown";
    const description = $("meta[name='description']").attr("content") || null;
    const coverImageUrl = $("meta[property='og:image']").attr("content") || null;

    const ajaxEndpoint = this.extractAjaxEndpoint(html);

    let chapters = [];
    if (ajaxEndpoint) {
      const payload = await fetchJson(ajaxEndpoint);
      chapters = (payload.data || []).map((d, idx) => ({
        id: `ch-${idx + 1}`,
        sourceUrl: `${root}/chapter-${d.n_sort}`,
        title: stripHtmlEntities(d.title),
      }));
    } else {
      const links = [];
      $("ul.chapter-list a").each((_i, el) => {
        links.push({
          href: $(el).attr("href"),
          text: stripHtmlEntities($(el).find(".chapter-title").text() || $(el).text()),
        });
      });
      chapters = this.normalizeChapterList(root, links);
    }

    return {
      parserId: this.id,
      metadata: this.metadataDefaults(root, title, author, description, coverImageUrl),
      chapters,
    };
  }

  extractAjaxEndpoint(html) {
    const marker = "/listChapterDataAjax";
    const index = html.indexOf(marker);
    if (index === -1) {
      return null;
    }
    const fragment = html.slice(index).match(/^\/listChapterDataAjax[^\"']+/)?.[0];
    if (!fragment) {
      return null;
    }
    const hostMatch = html.match(/https?:\/\/([^"'\\s]+)\//);
    if (!hostMatch) {
      return null;
    }

    return `https://${hostMatch[1]}${fragment}&draw=1&start=0&length=-1&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=asc`;
  }

  async fetchChapter(chapterUrl) {
    const { $ } = await fetchDom(chapterUrl);
    const title = $("span.chapter-title").first().text().trim() || $("h1").first().text().trim() || "Chapter";
    const content = $("div.chapter-content, div#content").first();
    content.find("script, style, .ads, .advertisement").remove();

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }
}
