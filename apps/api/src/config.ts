import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AppConfig = {
  port: number;
  dataRoot: string;
  outputDir: string;
  bookdropDir: string;
  configDir: string;
  jobsFile: string;
  builtWebRoot: string;
  legacyWebRoot: string;
};

function resolveDataRoot(): string {
  if (process.env.DATA_ROOT) {
    return process.env.DATA_ROOT;
  }
  if (fs.existsSync("/.dockerenv")) {
    return "/data";
  }
  return path.join(process.cwd(), ".data");
}

export function getAppConfig(): AppConfig {
  const dataRoot = resolveDataRoot();
  const outputDir = process.env.EPUB_OUTPUT_DIR || path.join(dataRoot, "epubs");
  const bookdropDir = process.env.BOOKDROP_DIR || path.join(dataRoot, "bookdrop");
  const configDir = process.env.CONFIG_DIR || path.join(dataRoot, "config");
  const jobsFile = path.join(configDir, "jobs.json");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const builtWebRoot = path.resolve(__dirname, "../../web/dist");
  const legacyWebRoot = path.resolve(__dirname, "../../web/public");

  return {
    port: Number(process.env.PORT || 3000),
    dataRoot,
    outputDir,
    bookdropDir,
    configDir,
    jobsFile,
    builtWebRoot,
    legacyWebRoot,
  };
}
