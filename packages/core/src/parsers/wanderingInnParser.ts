import { BaseParser } from "./baseParser.js";
import { fetchDom } from "../http.js";
import { stripHtmlEntities } from "../utils.js";

export class WanderingInnParser extends BaseParser {
  override id = "wanderinginn";

  override canHandle(url: string): boolean {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "wanderinginn.com";
  }

  private tocUrl(url: string): string {
    const parsed = new URL(url);
    if (parsed.pathname.includes("table-of-contents")) {
      return parsed.toString();
    }
    return `${parsed.origin}/table-of-contents/`;
  }

  override async preview(url: string) {
    const sourceUrl = this.tocUrl(url);
    const { $ } = await fetchDom(sourceUrl);

    const links: { href: string | undefined; text: string }[] = [];
    $("#table-of-contents a")
      .not(".book-title-num, .volume-book-card")
      .each((_i: number, el: any) => {
        links.push({
          href: $(el).attr("href"),
          text: stripHtmlEntities($(el).text()),
        });
      });

    const chapters = this.normalizeChapterList(sourceUrl, links);
    if (chapters.length === 0) {
      throw new Error("Could not extract chapter list from Wandering Inn table of contents");
    }

    const description = $("meta[name='description']").attr("content") || null;
    const coverImageUrl = $("meta[property='og:image']").attr("content") || null;

    return {
      parserId: this.id,
      metadata: this.metadataDefaults(sourceUrl, "The Wandering Inn", "pirateaba", description, coverImageUrl),
      chapters,
    };
  }

  override async fetchChapter(chapterUrl: string) {
    const { $ } = await fetchDom(chapterUrl);
    const content = $("div#reader-content").first();
    if (!content.length) {
      throw new Error("Could not find Wandering Inn chapter content");
    }

    this.preprocessRawDom($, content);
    content.find("a[href*='https://wanderinginn.com/']").remove();

    const title = this.extractChapterTitle($) || "Chapter";

    return {
      sourceUrl: chapterUrl,
      title,
      contentHtml: `<div>${content.html() || ""}</div>`,
    };
  }

  private extractChapterTitle($: any): string | null {
    let chosen: string | null = null;
    $("h2.elementor-heading-title").each((_i: number, el: any) => {
      if (chosen) {
        return;
      }
      const text = stripHtmlEntities($(el).text());
      if (text && text.toLowerCase() !== "loading...") {
        chosen = text;
      }
    });
    return chosen;
  }

  private preprocessRawDom($: any, content: any): void {
    content.find(".mrsha-write").each((_i: number, el: any) => {
      const style = ($(el).attr("style") || "").trim();
      const styleWithItalic = /font-style\s*:\s*italic/i.test(style)
        ? style
        : `${style}${style.endsWith(";") || style.length === 0 ? "" : ";"}font-style: italic;`;
      $(el).attr("style", styleWithItalic);
    });

    content.find("span[style*='color:']").each((_i: number, el: any) => {
      const classNames = new Set(
        (($(el).attr("class") || "") as string)
          .split(/\s+/)
          .map((name) => name.trim())
          .filter(Boolean)
      );
      classNames.add("ibooks-dark-theme-use-custom-text-color");
      $(el).attr("class", [...classNames].join(" "));
    });
  }
}
