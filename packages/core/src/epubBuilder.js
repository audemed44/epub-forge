import JSZip from "jszip";
import { escapeXml, sanitizeFilename } from "./utils.js";

function chapterFileName(index) {
  return `chapter-${String(index + 1).padStart(4, "0")}.xhtml`;
}

function chapterXhtml(title, html) {
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
  ${html}
</body>
</html>`;
}

function contentOpf(metadata, chapters) {
  const now = new Date().toISOString();
  const manifestChapters = chapters
    .map((chapter, idx) => `<item id="chapter-${idx + 1}" href="${chapterFileName(idx)}" media-type="application/xhtml+xml"/>`)
    .join("\n    ");

  const spineChapters = chapters
    .map((_chapter, idx) => `<itemref idref="chapter-${idx + 1}"/>`)
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(metadata.sourceUrl)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author)}</dc:creator>
    <dc:language>${escapeXml(metadata.language || "en")}</dc:language>
    ${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ""}
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="styles.css" media-type="text/css"/>
    ${manifestChapters}
  </manifest>
  <spine toc="ncx">
    ${spineChapters}
  </spine>
</package>`;
}

function tocNcx(metadata, chapters) {
  const navPoints = chapters
    .map((chapter, idx) => `
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="${chapterFileName(idx)}"/>
    </navPoint>`)
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

function navXhtml(chapters) {
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

export async function buildEpub(metadata, chapters) {
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
  oebps.file("styles.css", "body{font-family:serif;line-height:1.4;}h1{font-size:1.2em;}");

  chapters.forEach((chapter, idx) => {
    oebps.file(chapterFileName(idx), chapterXhtml(chapter.title, chapter.contentHtml));
  });

  oebps.file("content.opf", contentOpf(metadata, chapters));
  oebps.file("toc.ncx", tocNcx(metadata, chapters));
  oebps.file("nav.xhtml", navXhtml(chapters));

  const epubBuffer = await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
  const filename = `${sanitizeFilename(metadata.title)}.epub`;
  return { epubBuffer, filename };
}
