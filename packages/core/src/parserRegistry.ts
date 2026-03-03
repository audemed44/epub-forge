import { NovelFireParser } from "./parsers/novelFireParser.js";
import { RoyalRoadParser } from "./parsers/royalRoadParser.js";
import { SequentialNextLinkParser } from "./parsers/sequentialNextLinkParser.js";
import { WanderingInnParser } from "./parsers/wanderingInnParser.js";
import { WordpressGenericParser } from "./parsers/wordpressGenericParser.js";
import type { StoryParser } from "./types.js";

const parsers: StoryParser[] = [
  new RoyalRoadParser(),
  new NovelFireParser(),
  new WanderingInnParser(),
  new SequentialNextLinkParser(),
  new WordpressGenericParser(),
];

export function getParsers(): StoryParser[] {
  return parsers;
}

export function pickParser(url: string, explicitParserId: string | null = null): StoryParser {
  if (explicitParserId) {
    const selected = parsers.find((parser) => parser.id === explicitParserId);
    if (!selected) {
      throw new Error(`Unsupported parser '${explicitParserId}'`);
    }
    return selected;
  }

  const parser = parsers.find((item) => item.canHandle(url));
  if (!parser) {
    throw new Error("No parser available for this URL");
  }
  return parser;
}
