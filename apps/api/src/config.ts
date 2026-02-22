import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AppConfig = {
  port: number;
  dataRoot: string;
  outputDir: string;
  bookdropDir: string;
  configDir: string;
  jobsDbFile: string;
  legacyJobsFile: string;
  builtWebRoot: string;
  legacyWebRoot: string;
};

function resolveCliPortArg(argv: string[]): number | null {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }
    if (token === "--port" || token === "-p") {
      const candidate = argv[index + 1];
      if (!candidate) {
        return null;
      }
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (token.startsWith("--port=")) {
      const parsed = Number(token.slice("--port=".length));
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

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
  const cliPort = resolveCliPortArg(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  const outputDir = process.env.EPUB_OUTPUT_DIR || path.join(dataRoot, "epubs");
  const bookdropDir = process.env.BOOKDROP_DIR || path.join(dataRoot, "bookdrop");
  const configDir = process.env.CONFIG_DIR || path.join(dataRoot, "config");
  const jobsDbFile = process.env.JOBS_DB_FILE || path.join(configDir, "jobs.db");
  const legacyJobsFile = path.join(configDir, "jobs.json");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const builtWebRoot = path.resolve(__dirname, "../../web/dist");
  const legacyWebRoot = path.resolve(__dirname, "../../web/public");

  return {
    port: cliPort ?? Number(process.env.PORT || 3000),
    dataRoot,
    outputDir,
    bookdropDir,
    configDir,
    jobsDbFile,
    legacyJobsFile,
    builtWebRoot,
    legacyWebRoot,
  };
}
