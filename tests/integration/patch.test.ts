import { beforeAll, describe, expect, it } from "vitest";
import { clients, create, future, ORIGIN, patch, setupClients } from "./helpers";

beforeAll(setupClients);

describe("PATCH /api/consultations/[id]", () => {
  it.each([
    { name: "complete", actions: [{ action: "complete" }], status: 200, final: "completed" },
    {
      name: "complete then incomplete",
      actions: [{ action: "complete" }, { action: "incomplete" }],
      status: 200,
      final: "scheduled",
    },
    { name: "cancel", actions: [{ action: "cancel" }], status: 200, final: "cancelled" },
    {
      name: "reschedule",
      actions: [{ action: "reschedule", scheduledAt: future(10) }],
      status: 200,
      final: "scheduled",
    },
  ])("$name on own row", async ({ actions, status, final }) => {
    const id = await create();
    let last;
    for (const a of actions) last = await patch("student", id, a);
    expect(last!.res.status).toBe(status);
    expect(last!.body.status).toBe(final);
    expect(last!.body.id).toBe(id);
    expect(last!.body).not.toHaveProperty("student_id");
  });

  it.each([
    { name: "complete after cancel", first: "cancel", then: { action: "complete" }, status: 409 },
    {
      name: "reschedule after cancel",
      first: "cancel",
      then: { action: "reschedule", scheduledAt: future(9) },
      status: 409,
    },
    {
      name: "incomplete after cancel",
      first: "cancel",
      then: { action: "incomplete" },
      status: 409,
    },
    {
      name: "reschedule a completed row",
      first: "complete",
      then: { action: "reschedule", scheduledAt: future(5) },
      status: 409,
    },
  ])("$name", async ({ first, then, status }) => {
    const id = await create();
    await patch("student", id, { action: first });
    const r = await patch("student", id, then);
    expect(r.res.status).toBe(status);
    expect(r.body.error.code).toBe("conflict");
    expect(JSON.stringify(r.body)).not.toMatch(/immutable|P0001|trigger/);
  });

  it.each([
    {
      name: "reschedule to past",
      body: { action: "reschedule", scheduledAt: new Date(Date.now() - 5000).toISOString() },
      status: 400,
    },
    { name: "reschedule no date", body: { action: "reschedule" }, status: 400 },
    { name: "unknown action", body: { action: "delete" }, status: 400 },
    { name: "extra key", body: { action: "cancel", status: "scheduled" }, status: 400 },
    { name: "extra student_id", body: { action: "complete", student_id: "x" }, status: 400 },
  ])("$name", async ({ body, status }) => {
    const id = await create();
    expect((await patch("student", id, body)).res.status).toBe(status);
  });

  it.each([
    {
      name: "other student's row",
      actor: "student2" as const,
      idOf: "student" as const,
      status: 404,
    },
    {
      name: "admin cannot mutate",
      actor: "admin" as const,
      idOf: "student" as const,
      status: 403,
    },
  ])("$name", async ({ actor, idOf, status }) => {
    const id = await create(idOf);
    const r = await patch(actor, id, { action: "cancel" });
    expect(r.res.status).toBe(status);
    // row untouched
    const { data } = await clients.student
      .from("consultations")
      .select("status")
      .eq("id", id)
      .single();
    expect(data?.status).toBe("scheduled");
  });

  it.each([
    { name: "non-UUID id", id: "not-a-uuid", status: 404 },
    { name: "unknown UUID", id: "00000000-0000-4000-8000-000000000000", status: 404 },
  ])("$name -> 404", async ({ id, status }) => {
    expect((await patch("student", id, { action: "cancel" })).res.status).toBe(status);
  });

  it.each([{ name: "bad origin beats a non-UUID id", id: "not-a-uuid", status: 403 }])(
    "$name",
    async ({ id, status }) => {
      const headers = { origin: "http://evil.example", "content-type": "application/json" };
      const r = await patch("student", id, { action: "cancel" }, headers);
      expect(r.res.status).toBe(status);
      expect(r.body.error.code).toBe("forbidden_origin");
    },
  );

  it.each([
    {
      name: "bad origin",
      headers: { origin: "http://evil.example", "content-type": "application/json" },
      status: 403,
    },
    {
      name: "wrong content type",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      status: 415,
    },
  ])("$name", async ({ headers, status }) => {
    const id = await create();
    expect((await patch("student", id, { action: "cancel" }, headers)).res.status).toBe(status);
  });
});
