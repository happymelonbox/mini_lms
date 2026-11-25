import { describe, expect, it } from "vitest";
import { createSchema, encodeCursor, listQuerySchema, patchSchema } from "./schema";

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();
const valid = { firstName: "Ada", lastName: "Lovelace", reason: "Help", scheduledAt: future };

describe("createSchema", () => {
  it.each([
    { name: "valid", input: valid, ok: true },
    {
      name: "trims names",
      input: { ...valid, firstName: "  Ada " },
      ok: true,
      data: { firstName: "Ada" },
    },
    {
      name: "blank first name",
      input: { ...valid, firstName: "   " },
      ok: false,
      field: "firstName",
    },
    { name: "whitespace reason", input: { ...valid, reason: "  \n " }, ok: false, field: "reason" },
    {
      name: "name too long",
      input: { ...valid, lastName: "x".repeat(101) },
      ok: false,
      field: "lastName",
    },
    {
      name: "reason too long",
      input: { ...valid, reason: "x".repeat(1001) },
      ok: false,
      field: "reason",
    },
    {
      name: "NUL in reason",
      input: { ...valid, reason: "Hel\u0000p" },
      ok: false,
      field: "reason",
    },
    {
      name: "lone surrogate in first name",
      input: { ...valid, firstName: "\ud800" },
      ok: false,
      field: "firstName",
    },
    {
      name: "NUL in last name",
      input: { ...valid, lastName: "Le\u0000e" },
      ok: false,
      field: "lastName",
    },
    { name: "past date", input: { ...valid, scheduledAt: past }, ok: false, field: "scheduledAt" },
    {
      name: "no offset",
      input: { ...valid, scheduledAt: "2999-01-01T10:00:00" },
      ok: false,
      field: "scheduledAt",
    },
    { name: "unknown key student_id", input: { ...valid, student_id: "x" }, ok: false, field: "" },
    { name: "unknown key status", input: { ...valid, status: "completed" }, ok: false, field: "" },
    { name: "not an object", input: "nope", ok: false, field: "" },
  ])("$name", ({ input, ok, field, data }) => {
    const r = createSchema.safeParse(input);
    expect(r.success).toBe(ok);
    if (r.success && data) expect(r.data).toMatchObject(data);
    if (!r.success && field) expect(r.error.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe("patchSchema", () => {
  it.each([
    { name: "complete", input: { action: "complete" }, ok: true },
    { name: "incomplete", input: { action: "incomplete" }, ok: true },
    { name: "cancel", input: { action: "cancel" }, ok: true },
    { name: "reschedule", input: { action: "reschedule", scheduledAt: future }, ok: true },
    { name: "reschedule past", input: { action: "reschedule", scheduledAt: past }, ok: false },
    { name: "reschedule missing date", input: { action: "reschedule" }, ok: false },
    { name: "unknown action", input: { action: "delete" }, ok: false },
    { name: "extra key", input: { action: "cancel", status: "scheduled" }, ok: false },
    { name: "complete with date", input: { action: "complete", scheduledAt: future }, ok: false },
  ])("$name", ({ input, ok }) => {
    expect(patchSchema.safeParse(input).success).toBe(ok);
  });
});

const ID = "3f2c1a9e-5b7d-4c8e-9a10-0123456789ab";
const TS = "2026-11-26T23:04:51.09091+00:00"; // PostgREST format, microseconds
const c = (scheduledAt = TS, id = ID) => encodeCursor(scheduledAt, id);
const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("listQuerySchema", () => {
  it.each([
    { name: "defaults", input: {}, ok: true, expected: { pageSize: 10 } },
    {
      name: "after round-trip, microseconds kept",
      input: { after: c(), pageSize: "50" },
      ok: true,
      expected: { after: { scheduledAt: TS, id: ID }, pageSize: 50 },
    },
    {
      name: "before",
      input: { before: c() },
      ok: true,
      expected: { before: { scheduledAt: TS, id: ID }, pageSize: 10 },
    },
    { name: "space instead of T", input: { after: c("2026-11-26 23:04:51+00") }, ok: false },
    { name: "not base64url", input: { after: "a+b/c=" }, ok: false },
    { name: "three parts", input: { after: b64(`${TS}|${ID}|x`) }, ok: false },
    { name: "one part", input: { after: b64(TS) }, ok: false },
    { name: "bad uuid", input: { after: c(TS, "nope") }, ok: false },
    { name: "over 200 characters", input: { after: "a".repeat(201) }, ok: false },
    { name: "empty", input: { after: "" }, ok: false },
    { name: "after and before both set", input: { after: c(), before: c() }, ok: false },
    { name: "pageSize 51", input: { pageSize: "51" }, ok: false },
    { name: "pageSize 0", input: { pageSize: "0" }, ok: false },
    { name: "pageSize fractional", input: { pageSize: "1.5" }, ok: false },
  ])("$name", ({ input, ok, expected }) => {
    const r = listQuerySchema.safeParse(input);
    expect(r.success).toBe(ok);
    if (r.success) expect(r.data).toEqual(expected);
  });
});
