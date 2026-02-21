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
    const htmlChapters = await this.fetchAllHtmlChapters(chapterListingUrl, root, $);

    let chapters = [];
    if (ajaxEndpoint) {
      const ajaxChapters = await this.fetchAllAjaxChapters(ajaxEndpoint, root);
      chapters = ajaxChapters.length >= htmlChapters.length ? ajaxChapters : htmlChapters;
    } else {
      chapters = htmlChapters;
    }

    return {
      parserId: this.id,
      metadata: this.metadataDefaults(root, title, author, description, coverImageUrl),
      chapters,
    };
  }

  async fetchAllAjaxChapters(ajaxEndpoint, root) {
    const pageSize = 100;
    let start = 0;
    let hasMore = true;
    const chapterData = [];
    const seen = new Set();

    while (hasMore) {
      const requestUrl = this.buildAjaxPageUrl(ajaxEndpoint, start, pageSize);
      const payload = await fetchJson(requestUrl);
      const page = Array.isArray(payload?.data) ? payload.data : [];

      if (page.length === 0) {
        break;
      }

      for (const row of page) {
        const key = String(row?.n_sort ?? row?.title ?? Math.random());
        if (!seen.has(key)) {
          seen.add(key);
          chapterData.push(row);
        }
      }

      const recordsTotal = Number(payload?.recordsTotal ?? payload?.recordsFiltered ?? 0);
      if (recordsTotal > 0) {
        hasMore = chapterData.length < recordsTotal;
      } else {
        hasMore = page.length >= pageSize;
      }
      start += pageSize;
    }

    return chapterData.map((d, idx) => ({
      id: `ch-${idx + 1}`,
      sourceUrl: `${root}/chapter-${d.n_sort}`,
      title: stripHtmlEntities(d.title),
    }));
  }

  buildAjaxPageUrl(baseUrl, start, length) {
    return `${baseUrl}&draw=1&start=${start}&length=${length}&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=asc`;
  }

  async fetchAllHtmlChapters(chapterListingUrl, root, firstPageDom) {
    const chapters = this.extractHtmlChapterPage(firstPageDom, root);
    const pageUrls = this.extractTocPageUrls(firstPageDom, chapterListingUrl);

    for (const pageUrl of pageUrls) {
      const { $ } = await fetchDom(pageUrl);
      chapters.push(...this.extractHtmlChapterPage($, root));
    }

    const unique = new Map();
    for (const chapter of chapters) {
      if (!unique.has(chapter.sourceUrl)) {
        unique.set(chapter.sourceUrl, chapter);
      }
    }
    return [...unique.values()].map((chapter, idx) => ({ ...chapter, id: `ch-${idx + 1}` }));
  }

  extractHtmlChapterPage($, root) {
    const links = [];
    $("ul.chapter-list a").each((_i, el) => {
      links.push({
        href: $(el).attr("href"),
        text: stripHtmlEntities($(el).find(".chapter-title").text() || $(el).text()),
      });
    });
    return this.normalizeChapterList(root, links);
  }

  extractTocPageUrls($, chapterListingUrl) {
    const pageNumbers = $("ul.pagination li a")
      .toArray()
      .map((el) => {
        const href = $(el).attr("href");
        if (!href) {
          return null;
        }
        try {
          const page = Number(new URL(href, chapterListingUrl).searchParams.get("page"));
          return Number.isFinite(page) ? page : null;
        } catch {
          return null;
        }
      })
      .filter((page) => typeof page === "number" && page > 1);

    if (pageNumbers.length === 0) {
      return [];
    }

    const maxPage = Math.max(...pageNumbers);
    const base = new URL(chapterListingUrl);
    const urls = [];
    for (let page = 2; page <= maxPage; page += 1) {
      base.searchParams.set("page", String(page));
      urls.push(base.toString());
    }
    return urls;
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

    return `https://${hostMatch[1]}${fragment}`;
  }

  async fetchChapter(chapterUrl) {
    const { $ } = await fetchDom(chapterUrl);
    const title = $("span.chapter-title").first().text().trim() || $("h1").first().text().trim() || "Chapter";
    const content = $("div.chapter-content, div#content").first();
    content.find("script, style, .ads, .advertisement").remove();
    this.removeWatermarkParagraphs($, content);
    this.removeNestedStrongTags($, content);
    this.removeDlInfoBlocks($, content);

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }

  removeWatermarkParagraphs($, content) {
    content.find("p").each((_i, element) => {
      const className = ($(element).attr("class") || "").trim();
      if (className) {
        $(element).remove();
      }
    });
  }

  removeNestedStrongTags($, content) {
    content.find("strong strong").each((_i, element) => {
      $(element).parent().remove();
    });
  }

  removeDlInfoBlocks($, content) {
    content.find("div > dl > dt").each((_i, element) => {
      $(element).parent().parent().remove();
    });
  }
}
