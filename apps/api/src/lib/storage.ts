import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export function safeAsciiFilename(filename: string | null | undefined): string {
  const cleaned = (filename || "book.epub")
    .replace(/[\r\n"]/g, " ")
    .replace(/[\/\\:*?<>|]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "book.epub";
  }

  const withExtension = cleaned.toLowerCase().endsWith(".epub") ? cleaned : `${cleaned}.epub`;
  return withExtension.replace(/^\.+/, "").replace(/\.+$/, "") || "book.epub";
}

export async function resolveUniqueFilePath(directory: string, preferredFilename: string): Promise<string> {
  const safeName = safeAsciiFilename(preferredFilename);
  const parsed = path.parse(safeName);
  const baseName = parsed.name || "book";
  const extension = parsed.ext || ".epub";

  let candidate = path.join(directory, `${baseName}${extension}`);
  let counter = 2;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = path.join(directory, `${baseName} (${counter})${extension}`);
      counter += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return candidate;
      }
      throw error;
    }
  }
}

export async function ensureStoragePaths(outputDir: string, bookdropDir: string, configDir: string): Promise<void> {
  await fsp.mkdir(outputDir, { recursive: true });
  await fsp.mkdir(bookdropDir, { recursive: true });
  await fsp.mkdir(configDir, { recursive: true });
}

export async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fsp.rename(sourcePath, destinationPath);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "EXDEV") {
      throw error;
    }
  }

  await fsp.copyFile(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);

  try {
    await fsp.unlink(sourcePath);
  } catch (error) {
    await fsp.unlink(destinationPath).catch(() => {});
    throw error;
  }
}
