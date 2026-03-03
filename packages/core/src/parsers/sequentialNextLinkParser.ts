import { BaseParser } from "./baseParser.js";
import { fetchDom } from "../http.js";
import { stripHtmlEntities } from "../utils.js";

type NextCandidate = {
  href: string;
  score: number;
};

export class SequentialNextLinkParser extends BaseParser {
  override id = "sequential-next-link";

  override canHandle(url: string): boolean {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    // Blog-serial style links often use date segments.
    if (/\/\d{4}\/\d{2}\/\d{2}\//.test(parsed.pathname)) {
      return true;
    }

    const loweredPath = parsed.pathname.toLowerCase();
    return /chapter|arc|interlude|prologue|epilogue/.test(loweredPath);
  }

  private contentSelector(): string {
    return [
      "article .entry-content",
      "div.entry-content",
      "div.post-content",
      "article .post-content",
      "article .post-body",
      "div#reader-content",
      "main article",
      "article",
    ].join(", ");
  }

  private titleSelector(): string {
    return [
      "h1.entry-title",
      "h1.post-title",
      "h1.wp-block-post-title",
      "header .entry-title",
      "article h1",
      "h1",
    ].join(", ");
  }

  override async preview(url: string) {
    const startUrl = new URL(url).toString();
    const { $: first$ } = await fetchDom(startUrl);

    const firstContent = first$(this.contentSelector()).first();
    if (!firstContent.length) {
      throw new Error("Could not detect chapter content for sequential-next-link parser");
    }

    const storyTitle =
      stripHtmlEntities(first$("meta[property='og:site_name']").attr("content")) ||
      stripHtmlEntities(first$("meta[property='og:title']").attr("content")) ||
      this.extractChapterTitle(first$, startUrl, null);
    const author =
      stripHtmlEntities(first$("meta[name='author']").attr("content")) ||
      stripHtmlEntities(first$("[rel='author'], .author a, .byline a").first().text()) ||
      "Unknown";
    const description = first$("meta[name='description']").attr("content") || null;
    const coverImageUrl = first$("meta[property='og:image']").attr("content") || null;

    const chapters = await this.collectSequentialChapters(startUrl, storyTitle || "");
    if (chapters.length === 0) {
      throw new Error("Could not discover chapters by traversing next links");
    }

    return {
      parserId: this.id,
      metadata: this.metadataDefaults(startUrl, storyTitle || "Untitled", author, description, coverImageUrl),
      chapters,
    };
  }

  override async fetchChapter(chapterUrl: string) {
    const { $ } = await fetchDom(chapterUrl);
    const content = $(this.contentSelector()).first();
    if (!content.length) {
      throw new Error("Could not detect chapter content for this page");
    }

    const title = this.extractChapterTitle($, chapterUrl, stripHtmlEntities($("meta[property='og:site_name']").attr("content"))) || "Chapter";

    content.find("script, style, nav, noscript, .sharedaddy, .jp-relatedposts").remove();
    content.find("a[rel='next'], a[rel='prev']").remove();
    content
      .find("a")
      .filter((_i: number, element: any) => {
        const text = ($(element).text() || "").toLowerCase();
        return text.includes("next chapter") || text.includes("previous chapter") || text.startsWith("next ") || text.startsWith("previous ");
      })
      .remove();

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }

  private async collectSequentialChapters(startUrl: string, storyTitle: string) {
    const maxChapters = 2000;
    const chapters: { id: string; sourceUrl: string; title: string }[] = [];
    const seen = new Set<string>();
    const startHost = new URL(startUrl).hostname.replace(/^www\./, "").toLowerCase();

    let currentUrl: string | null = this.normalizeUrl(startUrl);
    while (currentUrl && !seen.has(currentUrl) && chapters.length < maxChapters) {
      seen.add(currentUrl);

      const { $ } = await fetchDom(currentUrl);
      const title = this.extractChapterTitle($, currentUrl, storyTitle) || `Chapter ${chapters.length + 1}`;
      chapters.push({
        id: `ch-${chapters.length + 1}`,
        sourceUrl: currentUrl,
        title,
      });

      const next = this.findNextUrl($, currentUrl, startHost);
      if (!next || seen.has(next)) {
        break;
      }
      currentUrl = next;
    }

    return chapters;
  }

  private findNextUrl($: any, currentUrl: string, allowedHost: string): string | null {
    const candidates: NextCandidate[] = [];
    const pushCandidate = (href: string | undefined, score: number) => {
      if (!href) {
        return;
      }

      const normalized = this.resolveOnHost(currentUrl, href, allowedHost);
      if (!normalized) {
        return;
      }
      candidates.push({ href: normalized, score });
    };

    pushCandidate($("link[rel='next']").attr("href"), 100);

    const navSelectors = [
      "#nav-below .nav-next a[rel='next']",
      "#nav-below .nav-next a",
      "a[rel='next']",
      ".post-navigation .nav-next a",
      ".site-navigation.post-navigation .nav-next a",
      ".nav-next a",
      ".navigation .next a",
    ];

    for (const selector of navSelectors) {
      pushCandidate($(selector).first().attr("href"), 90);
    }

    $("a[href]").each((_i: number, element: any) => {
      const text = stripHtmlEntities($(element).text()).toLowerCase();
      if (!text) {
        return;
      }

      if (text.startsWith("next") || text.includes("next chapter") || text.includes("next part") || text.endsWith("→")) {
        pushCandidate($(element).attr("href"), 70);
      }
    });

    if (candidates.length === 0) {
      return null;
    }

    const dedup = new Map<string, number>();
    for (const candidate of candidates) {
      const bestScore = dedup.get(candidate.href) ?? -1;
      if (candidate.score > bestScore) {
        dedup.set(candidate.href, candidate.score);
      }
    }

    let bestHref: string | null = null;
    let bestScore = -1;
    for (const [href, score] of dedup.entries()) {
      if (score > bestScore) {
        bestHref = href;
        bestScore = score;
      }
    }

    return bestHref;
  }

  private resolveOnHost(currentUrl: string, href: string, allowedHost: string): string | null {
    try {
      const resolved = this.normalizeUrl(new URL(href, currentUrl).toString());
      const host = new URL(resolved).hostname.replace(/^www\./, "").toLowerCase();
      return host === allowedHost ? resolved : null;
    } catch {
      return null;
    }
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  }

  private extractChapterTitle($: any, pageUrl: string, storyTitle: string | null): string {
    const rawHeading = stripHtmlEntities($(this.titleSelector()).first().text());
    const ogTitle = stripHtmlEntities($("meta[property='og:title']").attr("content"));
    const docTitleRaw = stripHtmlEntities($("title").first().text());
    const docTitle = stripHtmlEntities(docTitleRaw.split("|")[0]);

    const candidates = [rawHeading, ogTitle, docTitle].filter((value) => !!value);
    for (const candidate of candidates) {
      if (!storyTitle || candidate.toLowerCase() !== storyTitle.toLowerCase()) {
        return candidate;
      }
    }

    return this.titleFromSlug(pageUrl);
  }

  private titleFromSlug(pageUrl: string): string {
    const parsed = new URL(pageUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] || "chapter";

    const dotVersionSlug = slug.replace(/-(\d+)-(\d+)$/, "-$1.$2");
    const words = dotVersionSlug
      .replace(/[-_]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    return words
      .map((word) => {
        if (/^\d+(?:\.\d+)?$/.test(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
}
