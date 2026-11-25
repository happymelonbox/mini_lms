import { beforeAll, describe, expect, it } from "vitest";
import {
  BAD_ORIGIN,
  clients,
  create,
  future,
  NIL_UUID,
  patch,
  setupClients,
  TEXT_PLAIN,
} from "./helpers";

beforeAll(setupClients);

describe("PATCH /api/consultations/[id]", () => {
  it.each([
    { name: "complete", actions: [{ action: "complete" }], final: "completed" },
    {
      name: "complete then incomplete",
      actions: [{ action: "complete" }, { action: "incomplete" }],
      final: "scheduled",
    },
    { name: "cancel", actions: [{ action: "cancel" }], final: "cancelled" },
    {
      name: "reschedule",
      actions: [{ action: "reschedule", scheduledAt: future(10) }],
      final: "scheduled",
    },
  ])("$name on own row", async ({ actions, final }) => {
    const id = await create();
    let last;
    for (const a of actions) last = await patch("student", id, a);
    expect(last!.res.status).toBe(200);
    expect(last!.body.status).toBe(final);
    expect(last!.body.id).toBe(id);
    expect(last!.body).not.toHaveProperty("student_id");
  });

  it.each([
    { name: "complete after cancel", first: "cancel", then: { action: "complete" } },
    {
      name: "reschedule after cancel",
      first: "cancel",
      then: { action: "reschedule", scheduledAt: future(9) },
    },
    {
      name: "incomplete after cancel",
      first: "cancel",
      then: { action: "incomplete" },
    },
    {
      name: "reschedule a completed row",
      first: "complete",
      then: { action: "reschedule", scheduledAt: future(5) },
    },
  ])("$name", async ({ first, then }) => {
    const id = await create();
    await patch("student", id, { action: first });
    const r = await patch("student", id, then);
    expect(r.res.status).toBe(409);
    expect(r.body.error.code).toBe("conflict");
    expect(JSON.stringify(r.body)).not.toMatch(/immutable|P0001|trigger/);
  });

  it.each([
    {
      name: "reschedule to past",
      body: { action: "reschedule", scheduledAt: new Date(Date.now() - 5000).toISOString() },
    },
    { name: "extra student_id", body: { action: "complete", student_id: "x" } },
  ])("$name -> 400", async ({ body }) => {
    // The body is validated before the DB is touched, so no row is needed.
    expect((await patch("student", crypto.randomUUID(), body)).res.status).toBe(400);
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
    { name: "non-UUID id", id: "not-a-uuid" },
    { name: "unknown UUID", id: NIL_UUID },
  ])("$name -> 404", async ({ id }) => {
    expect((await patch("student", id, { action: "cancel" })).res.status).toBe(404);
  });

  it.each([
    {
      name: "bad origin beats a non-UUID id",
      headers: BAD_ORIGIN,
      status: 403,
      code: "forbidden_origin",
    },
    {
      name: "wrong content type",
      headers: TEXT_PLAIN,
      status: 415,
      code: "unsupported_media_type",
    },
  ])("$name", async ({ headers, status, code }) => {
    const r = await patch("student", "not-a-uuid", { action: "cancel" }, headers);
    expect(r.res.status).toBe(status);
    expect(r.body.error.code).toBe(code);
  });
});
