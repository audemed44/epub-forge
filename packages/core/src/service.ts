import { buildEpub } from "./epubBuilder.js";
import { getParsers, pickParser } from "./parserRegistry.js";
import type { BuildCallbacks, BuildFromSelectionInput, BuildResult, PreviewResponse } from "./types.js";

export async function previewUrl(url: string, parserId: string | null = null): Promise<PreviewResponse> {
  const parser = pickParser(url, parserId);
  return parser.preview(url);
}

export async function buildFromSelection(input: BuildFromSelectionInput, callbacks: BuildCallbacks = {}): Promise<BuildResult> {
  const { url, parserId = null, metadata, chapterUrls = [] } = input;
  const { onProgress = () => {}, onLog = () => {} } = callbacks;
  const parser = pickParser(url, parserId);

  const selected = chapterUrls.length ? chapterUrls : (await parser.preview(url)).chapters.map((chapter) => chapter.sourceUrl);

  onProgress({ stage: "fetching", completed: 0, total: selected.length });
  onLog(`Starting build for ${selected.length} chapters`);

  const chapterContents = [];
  for (let index = 0; index < selected.length; index += 1) {
    const chapterUrl = selected[index]!;
    onLog(`Fetching chapter ${index + 1}/${selected.length}`);
    // Sequential fetch is slower but more stable against rate limits.
    chapterContents.push(await parser.fetchChapter(chapterUrl));
    onProgress({ stage: "fetching", completed: index + 1, total: selected.length });
  }

  onProgress({ stage: "packing", completed: selected.length, total: selected.length });
  onLog("Packaging EPUB");
  const { epubBuffer, filename } = await buildEpub(metadata, chapterContents);
  onProgress({ stage: "done", completed: selected.length, total: selected.length });
  onLog("Build complete");
  return { epubBuffer, filename, chapterCount: chapterContents.length };
}

export function listParsers(): string[] {
  return getParsers().map((parser) => parser.id);
}
