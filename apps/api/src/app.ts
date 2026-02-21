import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { getAppConfig } from "./config.js";
import { ensureStoragePaths } from "./lib/storage.js";
import { JobsRepository } from "./jobs/repository.js";
import { BuildQueueService } from "./jobs/queueService.js";
import { createApiRouter } from "./routes/api.js";

export async function createApp() {
  const config = getAppConfig();
  await ensureStoragePaths(config.outputDir, config.bookdropDir, config.configDir);

  const repository = new JobsRepository(config.jobsDbFile, config.legacyJobsFile);
  await repository.init();

  const queue = new BuildQueueService({
    outputDir: config.outputDir,
    bookdropDir: config.bookdropDir,
    repository,
  });
  await queue.restore();
  void queue.processQueue().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  });

  const app = express();
  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "4mb" }));
  app.use("/api", createApiRouter(queue));

  if (process.env.ONE_PORT_DEV === "1") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), "apps/web"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const webRoot = fs.existsSync(config.builtWebRoot) ? config.builtWebRoot : config.legacyWebRoot;
    app.use(express.static(webRoot));
    app.get("*", (_req: any, res: any) => {
      res.sendFile(path.join(webRoot, "index.html"));
    });
  }

  return { app, config };
}
