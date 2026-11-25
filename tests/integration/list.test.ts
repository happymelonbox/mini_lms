import { beforeAll, describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/consultations/schema";
import { GET } from "@/app/api/consultations/route";
import { call, create, DTO_KEYS, NIL_UUID, setupClients } from "./helpers";

beforeAll(setupClients);

type Row = { id: string; scheduledAt: string };

describe("GET /api/consultations", () => {
  it.each([{ name: "student list: DTO keys, soonest first", actor: "student" as const }])(
    "$name",
    async ({ actor }) => {
      await create(actor);
      const { res, body } = await call(actor, GET, "/api/consultations?pageSize=50");
      expect(res.status).toBe(200);
      expect(body.data.length).toBeGreaterThan(0);
      for (const row of body.data) expect(Object.keys(row).sort()).toEqual(DTO_KEYS);
      const times = body.data.map((r: Row) => Date.parse(r.scheduledAt));
      expect(times).toEqual([...times].sort((a, b) => a - b));
    },
  );

  it.each([
    {
      name: "student2 never sees student's rows",
      owner: "student" as const,
      other: "student2" as const,
    },
  ])("$name", async ({ owner, other }) => {
    const ownerId = await create(owner);
    await create(other);
    const { body } = await call(other, GET, "/api/consultations?pageSize=50");
    expect(body.data.map((r: Row) => r.id)).not.toContain(ownerId);
  });

  const goodCursor = encodeCursor("2026-11-26T23:04:51.09091+00:00", NIL_UUID);
  it.each([
    { name: "pageSize 51", q: "?pageSize=51" },
    { name: "bad cursor", q: "?after=%21%21" },
    {
      name: "cursor with a bad uuid",
      q: `?before=${encodeCursor("2026-11-26T23:04:51+00:00", "nope")}`,
    },
    { name: "after and before both", q: `?after=${goodCursor}&before=${goodCursor}` },
  ])("pagination: $name -> 400", async ({ q }) => {
    expect((await call("student", GET, `/api/consultations${q}`)).res.status).toBe(400);
  });

  it.each([
    { name: "pageSize 1 honoured", q: "?pageSize=1", seed: true, want: { pageSize: 1 }, rows: 1 },
    {
      name: "stale cursor -> empty page, no cursors",
      q: `?after=${encodeCursor("9000-01-01T00:00:00+00:00", NIL_UUID)}`,
      seed: false,
      want: { data: [], nextCursor: null, prevCursor: null },
      rows: 0,
    },
    { name: "defaults", q: "", seed: false, want: { pageSize: 10 }, rows: undefined },
  ])("pagination: $name", async ({ q, seed, want, rows }) => {
    if (seed) await create();
    const { res, body } = await call("student", GET, `/api/consultations${q}`);
    expect(res.status).toBe(200);
    expect(body).toMatchObject(want);
    if (rows !== undefined) expect(body.data).toHaveLength(rows);
    expect(Object.keys(body).sort()).toEqual(["data", "nextCursor", "pageSize", "prevCursor"]);
  });

  it.each([{ name: "admin is refused", actor: "admin" as const, status: 403 }])(
    "$name",
    async ({ actor, status }) => {
      expect((await call(actor, GET, "/api/consultations")).res.status).toBe(status);
    },
  );
});
