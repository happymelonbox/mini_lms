import { describe, expect, it, vi } from "vitest";
import { dbErrorResponse, errorResponse, json } from "./respond";

describe("dbErrorResponse", () => {
  it.each([
    {
      name: "cancelled immutable",
      err: { code: "P0001", message: "consultation_cancelled_immutable" },
      status: 409,
      code: "conflict",
    },
    {
      name: "invalid transition",
      err: { code: "P0001", message: "invalid_status_transition" },
      status: 409,
      code: "conflict",
    },
    {
      name: "reschedule needs scheduled",
      err: { code: "P0001", message: "reschedule_requires_scheduled" },
      status: 409,
      code: "conflict",
    },
    {
      name: "past date",
      err: { code: "P0001", message: "scheduled_at_must_be_future" },
      status: 400,
      code: "validation_error",
    },
    {
      name: "check constraint",
      err: { code: "23514", message: "violates check constraint first_name_valid" },
      status: 400,
      code: "validation_error",
    },
    {
      name: "rate limited",
      err: { code: "P0001", message: "rate_limited" },
      status: 429,
      code: "rate_limited",
    },
    {
      name: "unknown guard",
      err: { code: "P0001", message: "student_id_immutable" },
      status: 500,
      code: "internal_error",
    },
    {
      name: "arbitrary",
      err: { code: "XX000", message: "secret internals" },
      status: 500,
      code: "internal_error",
    },
  ])("$name -> $status, never leaks raw text", async ({ err, status, code }) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = dbErrorResponse(err);
    log.mockRestore();
    expect(res.status).toBe(status);
    expect(res.headers.get("Retry-After")).toBe(status === 429 ? "60" : null);
    const text = await res.text();
    // the stable code may appear in `code`, never in the message
    expect(JSON.parse(text).error.message).not.toContain(err.message);
    expect(JSON.parse(text).error.code).toBe(code);
  });
});

describe("response helpers", () => {
  it.each([
    { name: "json", res: json({ a: 1 }, 201), status: 201 },
    { name: "error", res: errorResponse(404, "not_found", "Not found"), status: 404 },
  ])("$name is no-store JSON", ({ res, status }) => {
    expect(res.status).toBe(status);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});
