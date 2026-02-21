import JSZip from "jszip";
import { load } from "cheerio";
import he from "he";
import { escapeXml, sanitizeFilename } from "./utils.js";
import type { ChapterContent, StoryMetadata } from "./types.js";

type ImageAsset = {
  id: string;
  href: string;
  mediaType: string;
  sourceUrl: string;
  isCoverImage: boolean;
};

const SAFE_XML_ENTITIES = new Set(["amp", "lt", "gt", "quot", "apos"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
};

function chapterFileName(index: number): string {
  return `chapter-${String(index + 1).padStart(4, "0")}.xhtml`;
}

function chapterXhtml(title: string, html: string): string {
  const normalizedHtml = normalizeXhtmlFragment(html);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <meta charset="UTF-8" />
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  ${normalizedHtml}
</body>
</html>`;
}

function coverXhtml(title: string, imageHref: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)} - Cover</title>
  <meta charset="UTF-8" />
  <style>body{margin:0;padding:0}img{display:block;max-width:100%;height:auto;margin:0 auto}</style>
</head>
<body>
  <img src="${escapeXml(imageHref)}" alt="Cover image" />
</body>
</html>`;
}

function normalizeXhtmlFragment(html: string): string {
  const decoded = he.decode(html || "", { isAttributeValue: false, strict: false });
  const entityEscaped = decoded.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (full, name: string) => {
    if (SAFE_XML_ENTITIES.has(name)) {
      return full;
    }
    return `&amp;${name};`;
  });

  const htmlDoc = load(`<div id="epub-root">${entityEscaped}</div>`, { decodeEntities: false });
  const fragment = htmlDoc("#epub-root").html() || "";
  const xmlDoc = load(`<div id="epub-root">${fragment}</div>`, { xmlMode: true, decodeEntities: false });
  const xmlFragment = xmlDoc("#epub-root").html() || "";
  return replaceNamedEntitiesWithNumeric(xmlFragment);
}

function replaceNamedEntitiesWithNumeric(html: string): string {
  return html.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (full, name: string) => {
    if (SAFE_XML_ENTITIES.has(name)) {
      return full;
    }

    const decoded = he.decode(full, { strict: false });
    if (decoded === full) {
      return `&amp;${name};`;
    }

    let numeric = "";
    for (const ch of decoded) {
      numeric += `&#x${ch.codePointAt(0)!.toString(16).toUpperCase()};`;
    }
    return numeric;
  });
}

function safeAbsoluteUrl(baseUrl: string, maybeRelativeUrl: string): string | null {
  try {
    return new URL(maybeRelativeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function extensionFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\.([a-zA-Z0-9]{2,5})$/);
    return match ? `.${match[1]!.toLowerCase()}` : null;
  } catch {
    return null;
  }
}

function mediaTypeFromExtension(ext: string | null): string {
  const value = (ext || "").toLowerCase();
  if (value === ".jpg" || value === ".jpeg") {
    return "image/jpeg";
  }
  if (value === ".png") {
    return "image/png";
  }
  if (value === ".gif") {
    return "image/gif";
  }
  if (value === ".webp") {
    return "image/webp";
  }
  if (value === ".svg") {
    return "image/svg+xml";
  }
  if (value === ".avif") {
    return "image/avif";
  }
  return "application/octet-stream";
}

function contentOpf(
  metadata: StoryMetadata,
  chapters: ChapterContent[],
  options: { imageAssets: ImageAsset[]; coverPageHref: string | null; coverImageId: string | null }
): string {
  const now = new Date().toISOString();
  const manifestChapters = chapters
    .map((_chapter, idx) => `<item id="chapter-${idx + 1}" href="${chapterFileName(idx)}" media-type="application/xhtml+xml"/>`)
    .join("\n    ");

  const manifestImages = options.imageAssets
    .map((asset) => {
      const properties = asset.isCoverImage ? " properties=\"cover-image\"" : "";
      return `<item id="${asset.id}" href="${asset.href}" media-type="${asset.mediaType}"${properties}/>`;
    })
    .join("\n    ");

  const coverPageManifest = options.coverPageHref
    ? `<item id="cover-page" href="${options.coverPageHref}" media-type="application/xhtml+xml"/>`
    : "";

  const spineChapters = chapters.map((_chapter, idx) => `<itemref idref="chapter-${idx + 1}"/>`).join("\n    ");

  const coverPageSpine = options.coverPageHref ? "<itemref idref=\"cover-page\"/>\n    " : "";
  const coverMeta = options.coverImageId ? `<meta name="cover" content="${options.coverImageId}"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(metadata.sourceUrl)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author)}</dc:creator>
    <dc:language>${escapeXml(metadata.language || "en")}</dc:language>
    ${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ""}
    ${coverMeta}
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="styles.css" media-type="text/css"/>
    ${coverPageManifest}
    ${manifestChapters}
    ${manifestImages}
  </manifest>
  <spine toc="ncx">
    ${coverPageSpine}${spineChapters}
  </spine>
</package>`;
}

function tocNcx(metadata: StoryMetadata, chapters: ChapterContent[]): string {
  const navPoints = chapters
    .map(
      (chapter, idx) => `
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="${chapterFileName(idx)}"/>
    </navPoint>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(metadata.sourceUrl)}"/>
  </head>
  <docTitle><text>${escapeXml(metadata.title)}</text></docTitle>
  <navMap>${navPoints}
  </navMap>
</ncx>`;
}

function navXhtml(chapters: ChapterContent[]): string {
  const links = chapters
    .map((chapter, idx) => `<li><a href="${chapterFileName(idx)}">${escapeXml(chapter.title)}</a></li>`)
    .join("\n      ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Table of Contents</title>
  <meta charset="UTF-8" />
</head>
<body>
  <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${links}
    </ol>
  </nav>
</body>
</html>`;
}

function createImageCollector(oebps: JSZip): { addImage: (url: string, prefix?: string) => Promise<ImageAsset | null>; listAssets: () => ImageAsset[] } {
  const byUrl = new Map<string, ImageAsset>();
  const assets: ImageAsset[] = [];

  async function addImage(url: string, prefix = "image"): Promise<ImageAsset | null> {
    if (!url) {
      return null;
    }

    if (byUrl.has(url)) {
      return byUrl.get(url)!;
    }

    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (WebToEpub-Server)",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`Unable to fetch image ${url}: ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
    const ext = MIME_TO_EXT[contentType] || extensionFromUrl(url) || ".img";
    const mediaType = MIME_TO_EXT[contentType] ? contentType : mediaTypeFromExtension(ext);
    const index = assets.length + 1;
    const href = `images/${prefix}-${String(index).padStart(4, "0")}${ext}`;
    const id = `img-${index}`;
    const bytes = Buffer.from(await response.arrayBuffer());

    oebps.file(href, bytes);

    const asset: ImageAsset = { id, href, mediaType, sourceUrl: url, isCoverImage: false };
    assets.push(asset);
    byUrl.set(url, asset);
    return asset;
  }

  return {
    addImage,
    listAssets: () => assets,
  };
}

async function rewriteChapterImages(chapter: ChapterContent, collector: { addImage: (url: string, prefix?: string) => Promise<ImageAsset | null> }) {
  const doc = load(`<div id="chapter-root">${chapter.contentHtml || ""}</div>`, { decodeEntities: false });
  const images = doc("#chapter-root img").toArray();

  for (const node of images) {
    const img = doc(node);
    const src = img.attr("src");
    if (!src) {
      continue;
    }

    const absolute = safeAbsoluteUrl(chapter.sourceUrl, src);
    if (!absolute || absolute.startsWith("data:")) {
      continue;
    }

    try {
      const asset = await collector.addImage(absolute, "image");
      if (asset) {
        img.attr("src", asset.href);
        img.removeAttr("srcset");
        img.removeAttr("loading");
      }
    } catch {
      // Keep original image URL if fetch fails.
    }
  }

  return doc("#chapter-root").html() || "";
}

export async function buildEpub(metadata: StoryMetadata, chapters: ChapterContent[]) {
  if (!chapters.length) {
    throw new Error("No chapters selected");
  }

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const oebps = zip.folder("OEBPS");
  if (!oebps) {
    throw new Error("Unable to create EPUB structure");
  }
  oebps.file("styles.css", "body{font-family:serif;line-height:1.4;}h1{font-size:1.2em;}img{max-width:100%;height:auto}");

  const collector = createImageCollector(oebps);

  for (let idx = 0; idx < chapters.length; idx += 1) {
    const chapter = chapters[idx]!;
    const withLocalImages = await rewriteChapterImages(chapter, collector);
    oebps.file(chapterFileName(idx), chapterXhtml(chapter.title, withLocalImages));
  }

  let coverPageHref: string | null = null;
  let coverImageId: string | null = null;
  if (metadata.coverImageUrl) {
    const absoluteCoverUrl = safeAbsoluteUrl(metadata.sourceUrl, metadata.coverImageUrl);
    if (absoluteCoverUrl) {
      try {
        const coverAsset = await collector.addImage(absoluteCoverUrl, "cover");
        if (coverAsset) {
          coverAsset.isCoverImage = true;
          coverPageHref = "cover.xhtml";
          coverImageId = coverAsset.id;
          oebps.file(coverPageHref, coverXhtml(metadata.title || "Book", coverAsset.href));
        }
      } catch {
        // Proceed without embedded cover if fetch fails.
      }
    }
  }

  const imageAssets = collector.listAssets();
  oebps.file("content.opf", contentOpf(metadata, chapters, { imageAssets, coverPageHref, coverImageId }));
  oebps.file("toc.ncx", tocNcx(metadata, chapters));
  oebps.file("nav.xhtml", navXhtml(chapters));

  const epubBuffer = await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
  const baseName = metadata.fileName || metadata.title;
  const filename = `${sanitizeFilename(baseName)}.epub`;
  return { epubBuffer, filename };
}
