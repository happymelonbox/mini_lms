// JSON and error response helpers; maps database errors to safe HTTP responses.
import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodError } from "zod";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: { fields?: Record<string, string[]>; headers?: Record<string, string> } = {},
) {
  return json(
    { error: { code, message, ...(extra.fields && { fields: extra.fields }) } },
    status,
    extra.headers,
  );
}

export function validationError(error: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    // Unknown-key issues carry the offending keys instead of a path.
    const keys = issue.code === "unrecognized_keys" ? issue.keys : [issue.path.join(".") || "_"];
    for (const k of keys) (fields[k] ??= []).push(issue.message);
  }
  return errorResponse(400, "validation_error", "Invalid request", { fields });
}

// Trigger messages from 0002_consultations.sql that mean "not allowed in the current state".
const STATE_CONFLICTS = new Set([
  "consultation_cancelled_immutable",
  "invalid_status_transition",
  "reschedule_requires_scheduled",
]);

// Maps guard-trigger / constraint errors to safe messages; raw DB text is only logged.
export function dbErrorResponse(err: Pick<PostgrestError, "code" | "message">) {
  if (err.code === "P0001" && err.message === "rate_limited") {
    return errorResponse(429, "rate_limited", "Too many requests", {
      headers: { "Retry-After": "60" },
    });
  }
  if (err.code === "P0001" && STATE_CONFLICTS.has(err.message)) {
    return errorResponse(
      409,
      "conflict",
      "This consultation cannot be changed in its current state",
    );
  }
  if (err.code === "P0001" && err.message === "scheduled_at_must_be_future") {
    return errorResponse(400, "validation_error", "Invalid request", {
      fields: { scheduledAt: ["Must be in the future"] },
    });
  }
  if (err.code === "23514") {
    return errorResponse(400, "validation_error", "Invalid request");
  }
  console.error("db error", err.code, err.message);
  return errorResponse(500, "internal_error", "Something went wrong");
}
