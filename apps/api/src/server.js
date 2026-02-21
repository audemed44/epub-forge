import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFromSelection, listParsers, previewUrl } from "@scraper-epub/core";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, parsers: listParsers() });
});

app.post("/api/preview", async (req, res) => {
  try {
    const { url, parserId = null } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }

    const preview = await previewUrl(url, parserId);
    return res.json(preview);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/build", async (req, res) => {
  try {
    const { url, parserId = null, metadata, chapterUrls = [] } = req.body || {};
    if (!url || !metadata) {
      return res.status(400).json({ error: "url and metadata are required" });
    }

    const built = await buildFromSelection({ url, parserId, metadata, chapterUrls });
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${built.filename}"`);
    return res.send(built.epubBuffer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../../web/public");
app.use(express.static(webRoot));

app.get("*", (_req, res) => {
  res.sendFile(path.join(webRoot, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`scraper-epub listening on :${port}`);
});
