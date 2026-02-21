export async function getJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url);
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function postJson<T>(url: string, payload: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function deleteJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url, { method: "DELETE" });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}
