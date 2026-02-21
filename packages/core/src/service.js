import { buildEpub } from "./epubBuilder.js";
import { getParsers, pickParser } from "./parserRegistry.js";

export async function previewUrl(url, parserId = null) {
  const parser = pickParser(url, parserId);
  return parser.preview(url);
}

export async function buildFromSelection(input) {
  const { url, parserId = null, metadata, chapterUrls = [] } = input;
  const parser = pickParser(url, parserId);

  const selected = chapterUrls.length
    ? chapterUrls
    : (await parser.preview(url)).chapters.map((c) => c.sourceUrl);

  const chapterContents = [];
  for (const chapterUrl of selected) {
    // Sequential fetch is slower but more stable against rate limits.
    chapterContents.push(await parser.fetchChapter(chapterUrl));
  }

  const { epubBuffer, filename } = await buildEpub(metadata, chapterContents);
  return { epubBuffer, filename, chapterCount: chapterContents.length };
}

export function listParsers() {
  return getParsers().map((parser) => parser.id);
}
