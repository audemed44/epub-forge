declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
  exit(code?: number): never;
};

declare module "cors";
declare module "morgan";
declare module "express";
declare module "node:fs";
declare module "node:path";
declare module "node:url";
declare module "node:crypto";
declare module "node:fs/promises";
declare module "he";
