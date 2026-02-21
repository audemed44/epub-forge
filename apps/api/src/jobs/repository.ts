import fsp from "node:fs/promises";
import type { BuildJob } from "../types.js";

type JobFilePayload = { jobs: BuildJob[] };

export class JobsRepository {
  constructor(private readonly jobsFile: string) {}

  async load(): Promise<BuildJob[]> {
    try {
      const raw = await fsp.readFile(this.jobsFile, "utf8");
      const payload = JSON.parse(raw) as Partial<JobFilePayload>;
      return Array.isArray(payload?.jobs) ? payload.jobs : [];
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async save(jobs: BuildJob[]): Promise<void> {
    const payload: JobFilePayload = { jobs };
    await fsp.writeFile(this.jobsFile, JSON.stringify(payload, null, 2), "utf8");
  }
}
