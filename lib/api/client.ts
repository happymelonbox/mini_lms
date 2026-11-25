import type { CreateInput, PatchInput } from "@/lib/consultations/schema";

type ApiResult =
  | { ok: true }
  | { ok: false; status: number; error: { message: string; fields?: Record<string, string[]> } };

const GENERIC = "Something went wrong. Please try again.";

async function send(
  fetchImpl: typeof fetch,
  url: string,
  method: string,
  body: unknown,
): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { message: "Network error. Check your connection and try again." },
    };
  }
  if (res.ok) return { ok: true };
  const json = await res.json().catch(() => null);
  const e = json?.error;
  // 5xx text is never shown: the server already hides internals, and a proxy page would be noise.
  const message = res.status < 500 && typeof e?.message === "string" ? e.message : GENERIC;
  const fields =
    res.status === 400 && e?.fields && typeof e.fields === "object" ? e.fields : undefined;
  return { ok: false, status: res.status, error: { message, ...(fields && { fields }) } };
}

export const patchConsultation = (id: string, body: PatchInput, fetchImpl: typeof fetch = fetch) =>
  send(fetchImpl, `/api/consultations/${encodeURIComponent(id)}`, "PATCH", body);

export const createConsultationRequest = (body: CreateInput, fetchImpl: typeof fetch = fetch) =>
  send(fetchImpl, "/api/consultations", "POST", body);
