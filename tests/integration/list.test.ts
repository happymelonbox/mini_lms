import { beforeAll, describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/consultations/schema";
import { GET } from "@/app/api/consultations/route";
import { call, create, DTO_KEYS, setupClients } from "./helpers";

beforeAll(setupClients);

describe("GET /api/consultations", () => {
  it.each([
    {
      name: "student sees only own rows",
      actor: "student" as const,
      url: "/api/consultations?pageSize=50",
      status: 200,
    },
    {
      name: "student2 sees only own rows",
      actor: "student2" as const,
      url: "/api/consultations?pageSize=50",
      status: 200,
    },
  ])("$name", async ({ actor, url, status }) => {
    await create(actor);
    const { res, body } = await call(actor, GET, url);
    expect(res.status).toBe(status);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.total).toBeUndefined();
    for (const row of body.data) {
      expect(Object.keys(row).sort()).toEqual(DTO_KEYS);
    }
    const times = body.data.map((r: { scheduledAt: string }) => Date.parse(r.scheduledAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it.each([
    {
      name: "student2 never sees student's rows",
      owner: "student" as const,
      other: "student2" as const,
    },
    {
      name: "student never sees student2's rows",
      owner: "student2" as const,
      other: "student" as const,
    },
  ])("$name", async ({ owner, other }) => {
    await create(owner);
    await create(other);
    const a = await call(owner, GET, "/api/consultations?pageSize=50");
    const b = await call(other, GET, "/api/consultations?pageSize=50");
    const ids = new Set(a.body.data.map((r: { id: string }) => r.id));
    expect(b.body.data.some((r: { id: string }) => ids.has(r.id))).toBe(false);
  });

  const goodCursor = encodeCursor(
    "2026-11-26T23:04:51.09091+00:00",
    "3f2c1a9e-5b7d-4c8e-9a10-0123456789ab",
  );
  const nilUuid = "00000000-0000-0000-0000-000000000000";
  it.each([
    { name: "pageSize 51", q: "?pageSize=51", status: 400 },
    { name: "bad cursor", q: "?after=%21%21", status: 400 },
    {
      name: "cursor with a bad uuid",
      q: `?before=${encodeCursor("2026-11-26T23:04:51+00:00", "nope")}`,
      status: 400,
    },
    {
      name: "after and before both",
      q: `?after=${goodCursor}&before=${goodCursor}`,
      status: 400,
    },
    {
      name: "pageSize 1 honoured",
      q: "?pageSize=1",
      status: 200,
      check: (b: { data: unknown[]; pageSize: number }) => b.data.length === 1 && b.pageSize === 1,
    },
    {
      name: "stale cursor -> empty page, no cursors",
      q: `?after=${encodeCursor("9000-01-01T00:00:00+00:00", nilUuid)}`,
      status: 200,
      check: (b: { data: unknown[]; nextCursor: null; prevCursor: null }) =>
        b.data.length === 0 && b.nextCursor === null && b.prevCursor === null,
    },
    {
      name: "defaults",
      q: "",
      status: 200,
      check: (b: { pageSize: number; page?: number }) => b.pageSize === 10 && b.page === undefined,
    },
  ])("pagination: $name", async ({ q, status, check }) => {
    await create();
    const { res, body } = await call("student", GET, `/api/consultations${q}`);
    expect(res.status).toBe(status);
    if (check) expect(check(body)).toBe(true);
  });

  it.each([{ name: "admin is refused", actor: "admin" as const, status: 403 }])(
    "$name",
    async ({ actor, status }) => {
      expect((await call(actor, GET, "/api/consultations")).res.status).toBe(status);
    },
  );
});
