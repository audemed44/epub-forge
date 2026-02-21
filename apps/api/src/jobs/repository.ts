import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import type { BuildJob } from "../types.js";

export class JobsRepository {
  private db: Database | null = null;

  constructor(
    private readonly jobsDbFile: string,
    private readonly legacyJobsFile: string
  ) {}

  async init(): Promise<void> {
    await fsp.mkdir(path.dirname(this.jobsDbFile), { recursive: true });
    this.db = await open({ filename: this.jobsDbFile, driver: sqlite3.Database });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS build_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        progress_stage TEXT NOT NULL,
        progress_completed INTEGER NOT NULL,
        progress_total INTEGER NOT NULL,
        logs_json TEXT NOT NULL,
        request_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        finished_at INTEGER NULL,
        error TEXT NULL,
        result_path TEXT NULL,
        moved_to_bookdrop INTEGER NOT NULL DEFAULT 0,
        bookdrop_path TEXT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER NULL
      )
    `);

    await this.ensureArchiveColumns();
    await this.migrateLegacyJsonIfPresent();
  }

  async loadActive(): Promise<BuildJob[]> {
    const db = this.getDb();
    const rows = await db.all("SELECT * FROM build_jobs WHERE archived = 0 ORDER BY created_at DESC");
    return rows.map((row) => this.rowToJob(row));
  }

  async loadArchived(): Promise<BuildJob[]> {
    const db = this.getDb();
    const rows = await db.all("SELECT * FROM build_jobs WHERE archived = 1 ORDER BY created_at DESC");
    return rows.map((row) => this.rowToJob(row));
  }

  async getById(jobId: string): Promise<BuildJob | null> {
    const db = this.getDb();
    const row = await db.get("SELECT * FROM build_jobs WHERE id = ?", [jobId]);
    return row ? this.rowToJob(row) : null;
  }

  async save(jobs: BuildJob[]): Promise<void> {
    const db = this.getDb();
    await db.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      for (const job of jobs) {
        await db.run(
          `
          INSERT INTO build_jobs (
            id,
            status,
            progress_stage,
            progress_completed,
            progress_total,
            logs_json,
            request_json,
            created_at,
            finished_at,
            error,
            result_path,
            moved_to_bookdrop,
            bookdrop_path,
            archived,
            archived_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            progress_stage = excluded.progress_stage,
            progress_completed = excluded.progress_completed,
            progress_total = excluded.progress_total,
            logs_json = excluded.logs_json,
            request_json = excluded.request_json,
            created_at = excluded.created_at,
            finished_at = excluded.finished_at,
            error = excluded.error,
            result_path = excluded.result_path,
            moved_to_bookdrop = excluded.moved_to_bookdrop,
            bookdrop_path = excluded.bookdrop_path,
            archived = 0,
            archived_at = NULL
          `,
          [
            job.id,
            job.status,
            job.progress.stage,
            job.progress.completed,
            job.progress.total,
            JSON.stringify(job.logs || []),
            JSON.stringify(job.request),
            job.createdAt,
            job.finishedAt,
            job.error,
            job.resultPath,
            job.movedToBookdrop ? 1 : 0,
            job.bookdropPath,
          ]
        );
      }
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }

  async archive(jobIds: string[]): Promise<void> {
    if (jobIds.length === 0) {
      return;
    }
    const db = this.getDb();
    const placeholders = jobIds.map(() => "?").join(", ");
    await db.run(`UPDATE build_jobs SET archived = 1, archived_at = ? WHERE id IN (${placeholders})`, [Date.now(), ...jobIds]);
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error("JobsRepository not initialized");
    }
    return this.db;
  }

  private rowToJob(row: any): BuildJob {
    return {
      id: row.id,
      status: row.status,
      progress: {
        stage: row.progress_stage,
        completed: Number(row.progress_completed || 0),
        total: Number(row.progress_total || 0),
      },
      logs: parseJsonArray(row.logs_json),
      request: parseJsonObject(row.request_json),
      createdAt: Number(row.created_at),
      finishedAt: row.finished_at == null ? null : Number(row.finished_at),
      error: row.error || null,
      resultPath: row.result_path || null,
      movedToBookdrop: !!row.moved_to_bookdrop,
      bookdropPath: row.bookdrop_path || null,
      archived: !!(row.archived ?? row.cleared ?? 0),
    };
  }

  private async ensureArchiveColumns(): Promise<void> {
    const db = this.getDb();
    const columns = (await db.all("PRAGMA table_info(build_jobs)")) as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));

    if (!names.has("archived")) {
      await db.exec("ALTER TABLE build_jobs ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
    }
    if (!names.has("archived_at")) {
      await db.exec("ALTER TABLE build_jobs ADD COLUMN archived_at INTEGER NULL");
    }

    if (names.has("cleared")) {
      await db.exec("UPDATE build_jobs SET archived = 1 WHERE cleared = 1");
    }
    if (names.has("cleared_at")) {
      await db.exec("UPDATE build_jobs SET archived_at = COALESCE(archived_at, cleared_at)");
    }
  }

  private async migrateLegacyJsonIfPresent(): Promise<void> {
    if (!fs.existsSync(this.legacyJobsFile)) {
      return;
    }

    try {
      const raw = await fsp.readFile(this.legacyJobsFile, "utf8");
      const parsed = JSON.parse(raw) as { jobs?: BuildJob[] };
      const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      if (jobs.length > 0) {
        await this.save(
          jobs.map((job) => ({
            ...job,
            logs: Array.isArray(job.logs) ? job.logs : [],
            resultPath: job.resultPath || null,
            movedToBookdrop: !!job.movedToBookdrop,
            bookdropPath: job.bookdropPath || null,
            archived: !!job.archived,
          }))
        );
      }
      await fsp.rename(this.legacyJobsFile, `${this.legacyJobsFile}.migrated-${Date.now()}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to migrate legacy jobs.json:", error);
    }
  }
}

function parseJsonArray(input: string | null | undefined): string[] {
  if (!input) {
    return [];
  }
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(input: string | null | undefined): T {
  if (!input) {
    return {} as T;
  }
  try {
    return JSON.parse(input) as T;
  } catch {
    return {} as T;
  }
}
