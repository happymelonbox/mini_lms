// Request checks shared by route handlers: Origin and Content-Type, capped JSON body, query parsing.
import type { z } from "zod";
import { listQuerySchema, type ListQuery } from "@/lib/consultations/schema";
import { errorResponse, validationError } from "./respond";

const MAX_BODY_BYTES = 10 * 1024;

/*
 * Order every handler follows (cheapest and least-informative rejections first):
 *   auth+role (401/403) -> origin 403 -> content-type 415 -> id 404 -> body/validate 400/413 -> query
 * Read-only routes skip origin, content-type and body.
 */

// CSRF: cookies are SameSite=Lax, and we additionally require an exact Origin match. Fails closed.
export function checkMutationHeaders(req: Request): Response | null {
  const expected = process.env.APP_ORIGIN;
  const origin = req.headers.get("origin");
  if (!expected || !origin || origin !== expected) {
    return errorResponse(403, "forbidden_origin", "Forbidden");
  }
  const type = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    return errorResponse(415, "unsupported_media_type", "Content-Type must be application/json");
  }
  return null;
}

// Reads at most MAX_BODY_BYTES: the declared length can lie or be absent (chunked), so count the stream and abort.
async function readCapped(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Blob(chunks as BlobPart[]).text();
}

export async function parseJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { response: Response }> {
  const tooBig = {
    response: errorResponse(413, "payload_too_large", "Body must be 10 KB or less"),
  };
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return tooBig;
  const text = await readCapped(req);
  if (text === null) return tooBig;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { response: errorResponse(400, "invalid_json", "Malformed JSON") };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { data: parsed.data } : { response: validationError(parsed.error) };
}

export function parsePageQuery(req: Request): { query: ListQuery } | { response: Response } {
  const params = new URL(req.url).searchParams;
  const parsed = listQuerySchema.safeParse(Object.fromEntries(params));
  return parsed.success ? { query: parsed.data } : { response: validationError(parsed.error) };
}
