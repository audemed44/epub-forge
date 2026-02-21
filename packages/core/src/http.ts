import { load, type CheerioAPI } from "cheerio";

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.text();
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

export async function fetchDom(url: string, init?: RequestInit): Promise<{ $: CheerioAPI; html: string }> {
  const html = await fetchText(url, init);
  return { $: load(html), html };
}
