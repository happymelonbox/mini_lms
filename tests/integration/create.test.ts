import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/consultations/route";
import {
  type Actor,
  call,
  clients,
  DTO_KEYS,
  freshStudent,
  future,
  JSON_HEADERS,
  ORIGIN,
  setupClients,
  valid,
} from "./helpers";

beforeAll(setupClients);

type FieldErrors = { error: { fields: Record<string, string[]> } };

const post = (actor: Actor, body: unknown, headers: Record<string, string> = JSON_HEADERS) =>
  call(actor, POST, "/api/consultations", { method: "POST", headers, body });

describe("POST /api/consultations", () => {
  it.each([
    {
      name: "valid -> 201 DTO",
      actor: "student" as const,
      body: valid(),
      status: 201,
      check: (b: Record<string, unknown>) =>
        Object.keys(b).sort().join() === DTO_KEYS.join() && b.status === "scheduled",
    },
    {
      name: "trims input",
      actor: "student" as const,
      body: { ...valid(), firstName: "  Ann  " },
      status: 201,
      check: (b: Record<string, unknown>) => b.firstName === "Ann",
    },
    {
      name: "unknown key student_id",
      actor: "student" as const,
      body: { ...valid(), student_id: "22222222-2222-4222-8222-222222222222" },
      status: 400,
      check: (b: { error: { fields: object } }) => "student_id" in b.error.fields,
    },
    {
      name: "unknown key status",
      actor: "student" as const,
      body: { ...valid(), status: "completed" },
      status: 400,
    },
    {
      name: "past date",
      actor: "student" as const,
      body: { ...valid(), scheduledAt: new Date(Date.now() - 1000).toISOString() },
      status: 400,
      check: (b: FieldErrors) => !!b.error.fields.scheduledAt,
    },
    {
      name: "missing offset",
      actor: "student" as const,
      body: { ...valid(), scheduledAt: "2999-01-01T10:00:00" },
      status: 400,
    },
    {
      name: "blank name",
      actor: "student" as const,
      body: { ...valid(), firstName: "   " },
      status: 400,
      check: (b: FieldErrors) => !!b.error.fields.firstName,
    },
    {
      name: "NUL in reason -> 400 field error, not 500",
      actor: "student" as const,
      body: { ...valid(), reason: "Hel\u0000p" },
      status: 400,
      check: (b: FieldErrors) => !!b.error.fields.reason,
    },
    { name: "admin refused", actor: "admin" as const, body: valid(), status: 403 },
    {
      name: "admin refused before validation",
      actor: "admin" as const,
      body: {},
      status: 403,
      check: (b: { error: { code: string } }) => b.error.code === "forbidden",
    },
  ])("$name", async ({ actor, body, status, check }) => {
    const r = await post(actor, body);
    expect(r.res.status).toBe(status);
    if (check) expect(check(r.body)).toBe(true);
  });

  it.each([
    {
      name: "wrong content type",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      body: JSON.stringify(valid()),
      status: 415,
    },
    {
      name: "missing origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid()),
      status: 403,
    },
    {
      name: "bad origin",
      headers: { origin: "http://evil.example", "content-type": "application/json" },
      body: JSON.stringify(valid()),
      status: 403,
    },
    {
      name: "oversized body",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...valid(), reason: "x".repeat(11_000) }),
      status: 413,
    },
    { name: "malformed JSON", headers: JSON_HEADERS, body: "{not json", status: 400 },
  ])("$name", async ({ headers, body, status }) => {
    const r = await post("student", body, headers as Record<string, string>);
    expect(r.res.status).toBe(status);
  });

  it.each([{ name: "11th request in a minute -> 429 + Retry-After 60 (DB rate limit)", n: 10 }])(
    "$name",
    async ({ n }) => {
      await freshStudent("student");
      for (let i = 0; i < n; i++) expect((await post("student", valid())).res.status).toBe(201);
      const r = await post("student", valid());
      expect(r.res.status).toBe(429);
      expect(r.res.headers.get("retry-after")).toBe("60");
      expect(r.body.error.code).toBe("rate_limited");
      // another user is unaffected
      expect((await post("student2", valid())).res.status).toBe(201);
      // and the limit also holds below the API: a direct bulk insert of 11 is refused by the DB
      await freshStudent("student");
      const { data: me } = await clients.student.auth.getUser();
      const rows = Array.from({ length: 11 }, () => ({
        student_id: me.user!.id,
        first_name: "Bulk",
        last_name: "Insert",
        reason: "x",
        scheduled_at: future(),
      }));
      const bulk = await clients.student.from("consultations").insert(rows);
      expect(bulk.error?.message).toBe("rate_limited");
      const { count } = await clients.student
        .from("consultations")
        .select("*", { count: "exact", head: true });
      expect(count).toBe(0);
    },
  );

  it.each([
    {
      name: "15 parallel bookings -> at most 10 created, the rest 429 (try-lock never queues)",
      n: 15,
    },
  ])("$name", async ({ n }) => {
    await freshStudent("student");
    const responses = await Promise.all(Array.from({ length: n }, () => post("student", valid())));
    const statuses = responses.map((r) => r.res.status);
    const successes = statuses.filter((x) => x === 201).length;
    expect(successes).toBeLessThanOrEqual(10);
    expect(successes).toBeGreaterThanOrEqual(1);
    expect(statuses.filter((x) => x !== 201).every((x) => x === 429)).toBe(true);
    // what the API reported is what the DB holds: no over-limit row slipped through the lock
    const { count } = await clients.student
      .from("consultations")
      .select("*", { count: "exact", head: true });
    expect(count).toBe(successes);
    await freshStudent("student");
  });
});
