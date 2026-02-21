import { NovelFireParser } from "./parsers/novelFireParser.js";
import { RoyalRoadParser } from "./parsers/royalRoadParser.js";
import { WordpressGenericParser } from "./parsers/wordpressGenericParser.js";

const parsers = [
  new RoyalRoadParser(),
  new NovelFireParser(),
  new WordpressGenericParser(),
];

export function getParsers() {
  return parsers;
}

export function pickParser(url, explicitParserId = null) {
  if (explicitParserId) {
    const selected = parsers.find((p) => p.id === explicitParserId);
    if (!selected) {
      throw new Error(`Unsupported parser '${explicitParserId}'`);
    }
    return selected;
  }

  const parser = parsers.find((p) => p.canHandle(url));
  if (!parser) {
    throw new Error("No parser available for this URL");
  }
  return parser;
}
