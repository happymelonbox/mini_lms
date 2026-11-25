import { beforeAll, describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/consultations/schema";
import { GET as adminGET } from "@/app/api/admin/consultations/route";
import { GET } from "@/app/api/consultations/route";
import {
  type Actor,
  call,
  clients,
  create,
  freshStudent,
  type Handler,
  NIL_UUID,
  setupClients,
} from "./helpers";

beforeAll(setupClients);

// Keyset walks. Rows sit at fixed far-future instants so nothing else in the shared DB lands in the window.
type Page = {
  data: { id: string; scheduledAt: string }[];
  nextCursor: string | null;
  prevCursor: string | null;
};
const walk = async (
  actor: Actor,
  fn: Handler,
  url: string,
  param: "after" | "before",
  start: string,
  pages: number,
) => {
  const ids: string[] = [];
  let cursor: string | null = start;
  for (let i = 0; i < pages && cursor; i++) {
    const { body }: { body: Page } = await call(actor, fn, `${url}?pageSize=1&${param}=${cursor}`);
    ids.push(...body.data.map((r) => r.id));
    cursor = param === "after" ? body.nextCursor : body.prevCursor;
  }
  return ids;
};
const at = (base: number, ms: number) => new Date(base + ms).toISOString();

describe("keyset pagination", () => {
  it.each([
    { name: "distinct instants", offsets: [0, 1000, 2000, 3000] },
    {
      name: "three bookings at the same instant plus a later one",
      offsets: [0, 0, 0, 1000],
    },
  ])(
    "student walk forward then back returns every row once, in order: $name",
    async ({ offsets }) => {
      await freshStudent("student");
      const base = Date.UTC(2600, 0, 1) + Math.floor(Math.random() * 1e9);
      const ids = [];
      for (const o of offsets) ids.push(await create("student", { scheduledAt: at(base, o) }));
      const { data: rows } = await clients.student
        .from("consultations")
        .select("id")
        .order("scheduled_at")
        .order("id");
      const ordered = rows!.map((r) => r.id);
      expect([...ordered].sort()).toEqual([...ids].sort());
      const start = encodeCursor(at(base, -1), NIL_UUID);
      const fwd = await walk("student", GET, "/api/consultations", "after", start, 10);
      expect(fwd).toEqual(ordered);
      // back from just past the last row
      const end = encodeCursor(at(base, 5000), "ffffffff-ffff-4fff-8fff-ffffffffffff");
      const back = await walk("student", GET, "/api/consultations", "before", end, 10);
      expect(back).toEqual([...ordered].reverse());
    },
  );

  it.each([{ name: "admin walk covers rows of two students" }])("$name", async () => {
    const base = Date.UTC(2700, 0, 1) + Math.floor(Math.random() * 1e9);
    const a = await create("student", { scheduledAt: at(base, 0) });
    const b = await create("student2", { scheduledAt: at(base, 500) });
    const c = await create("student", { scheduledAt: at(base, 1000) });
    const start = encodeCursor(at(base, -1), NIL_UUID);
    const got = await walk("admin", adminGET, "/api/admin/consultations", "after", start, 3);
    expect(got).toEqual([a, b, c]);
  });

  it.each([{ name: "default page starts at now; Earlier is offered and stays before it" }])(
    "$name",
    async () => {
      const t0 = Date.now();
      await create("student");
      const { body } = await call("admin", adminGET, "/api/admin/consultations?pageSize=5");
      const page = body as Page;
      expect(page.data.length).toBeGreaterThan(0);
      for (const r of page.data) expect(Date.parse(r.scheduledAt)).toBeGreaterThanOrEqual(t0);
      expect(page.prevCursor).not.toBeNull();
      const earlier = `/api/admin/consultations?pageSize=5&before=${page.prevCursor}`;
      const back = (await call("admin", adminGET, earlier)).body as Page;
      for (const r of back.data)
        expect(Date.parse(r.scheduledAt)).toBeLessThan(Date.parse(page.data[0].scheduledAt));
    },
  );
});
