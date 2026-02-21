export function absoluteUrl(base: string, href: string | undefined): string | null {
  try {
    if (!href) {
      return null;
    }
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function uniqueBy<T, K>(items: T[], selector: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function sanitizeFilename(name: string | null | undefined): string {
  const safe = (name || "book")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return safe.length ? safe : "book";
}

export function stripHtmlEntities(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

export function escapeXml(value: string | null | undefined): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
