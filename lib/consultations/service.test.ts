import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { encodeCursor } from "./schema";
import {
  createConsultation,
  listAllConsultations,
  listOwnConsultations,
  updateConsultation,
} from "./service";

type Call = [method: string, ...args: unknown[]];
type Response = { data: unknown; error: unknown };

// Chainable stand-in for the PostgREST builder: records every call, resolves at the terminal one.
function fakeDb(response: Response) {
  const calls: Call[] = [];
  const terminal = new Set(["limit", "single", "maybeSingle"]);
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "eq",
    "gte",
    "lte",
    "or",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return terminal.has(method) ? Promise.resolve(response) : builder;
    };
  }
  const db = { from: (table: string) => (calls.push(["from", table]), builder) };
  return { db: db as unknown as SupabaseClient<Database>, calls };
}

const row = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  student_id: "student-secret",
  first_name: `First${n}`,
  last_name: `Last${n}`,
  reason: `Reason${n}`,
  scheduled_at: `2030-01-0${n}T10:00:00+00:00`,
  status: "scheduled",
  created_at: `2029-12-0${n}T10:00:00+00:00`,
  updated_at: `2029-12-0${n}T11:00:00+00:00`,
});
const dto = (n: number) => ({
  id: row(n).id,
  firstName: `First${n}`,
  lastName: `Last${n}`,
  reason: `Reason${n}`,
  scheduledAt: row(n).scheduled_at,
  status: "scheduled",
  createdAt: row(n).created_at,
  updatedAt: row(n).updated_at,
});
const cur = (n: number) => encodeCursor(row(n).scheduled_at, row(n).id);
const at = { scheduledAt: "2030-01-05T10:00:00Z", id: "00000000-0000-4000-8000-000000000005" };
const ok = (rows: unknown[]) => ({ data: rows, error: null });
const NOW = "2030-06-01T12:00:00.000Z";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const DB_ERROR = { code: "XX000", message: "boom" };

beforeEach(() => {
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("list queries: keyset shape", () => {
  it.each([
    {
      name: "forward (after): gte bound, .or() gt, ascending, limit n+1",
      query: { after: at, pageSize: 2 },
      bound: ["gte", "scheduled_at", at.scheduledAt],
      or: `scheduled_at.gt.${at.scheduledAt},and(scheduled_at.eq.${at.scheduledAt},id.gt.${at.id})`,
      ascending: true,
      limit: 3,
    },
    {
      name: "backward (before): lte bound, .or() lt, descending, limit n+1",
      query: { before: at, pageSize: 4 },
      bound: ["lte", "scheduled_at", at.scheduledAt],
      or: `scheduled_at.lt.${at.scheduledAt},and(scheduled_at.eq.${at.scheduledAt},id.lt.${at.id})`,
      ascending: false,
      limit: 5,
    },
    {
      name: "no cursor: forward page from 'now' with the nil uuid",
      query: { pageSize: 2 },
      bound: ["gte", "scheduled_at", NOW],
      or: `scheduled_at.gt.${NOW},and(scheduled_at.eq.${NOW},id.gt.${NIL_UUID})`,
      ascending: true,
      limit: 3,
    },
  ])("$name", async ({ query, bound, or, ascending, limit }) => {
    const { db, calls } = fakeDb(ok([]));
    await listAllConsultations(db, query);
    expect(calls).toEqual([
      ["from", "consultations"],
      ["select", "*"],
      bound,
      ["or", or],
      ["order", "scheduled_at", { ascending }],
      ["order", "id", { ascending }],
      ["limit", limit],
    ]);
  });

  it.each([
    {
      name: "own list filters by student_id",
      run: (db: SupabaseClient<Database>) => listOwnConsultations(db, "u1", { pageSize: 10 }),
      eq: [["eq", "student_id", "u1"]],
    },
    {
      name: "admin list does not",
      run: (db: SupabaseClient<Database>) => listAllConsultations(db, { pageSize: 10 }),
      eq: [],
    },
  ])("$name", async ({ run, eq }) => {
    const { db, calls } = fakeDb(ok([]));
    await run(db);
    expect(calls.filter((c) => c[0] === "eq")).toEqual(eq);
  });
});

describe("list results: DTO mapping and cursors", () => {
  it.each([
    {
      name: "forward, more rows: drops the extra row, offers next and prev",
      query: { after: at, pageSize: 2 },
      rows: [row(1), row(2), row(3)],
      expected: { data: [dto(1), dto(2)], nextCursor: cur(2), prevCursor: cur(1) },
    },
    {
      name: "forward, last page: no next cursor",
      query: { after: at, pageSize: 2 },
      rows: [row(1), row(2)],
      expected: { data: [dto(1), dto(2)], nextCursor: null, prevCursor: cur(1) },
    },
    {
      name: "forward, empty page after a cursor: no prev",
      query: { after: at, pageSize: 2 },
      rows: [],
      expected: { data: [], nextCursor: null, prevCursor: null },
    },
    {
      name: "backward, more rows: restores ascending order, offers prev and next",
      query: { before: at, pageSize: 2 },
      rows: [row(3), row(2), row(1)],
      expected: { data: [dto(2), dto(3)], nextCursor: cur(3), prevCursor: cur(2) },
    },
    {
      name: "backward, first page: no prev cursor",
      query: { before: at, pageSize: 2 },
      rows: [row(2), row(1)],
      expected: { data: [dto(1), dto(2)], nextCursor: cur(2), prevCursor: null },
    },
    {
      name: "default view over an empty page still offers earlier",
      query: { pageSize: 2 },
      rows: [],
      expected: { data: [], nextCursor: null, prevCursor: encodeCursor(NOW, NIL_UUID) },
    },
  ])("$name", async ({ query, rows, expected }) => {
    const { db } = fakeDb(ok(rows));
    expect(await listAllConsultations(db, query)).toEqual({ ok: true, value: expected });
  });

  it.each([{ name: "student_id never reaches the DTO" }])("$name", async () => {
    const { db } = fakeDb(ok([row(1)]));
    const result = await listAllConsultations(db, { pageSize: 10 });
    expect(JSON.stringify(result)).not.toContain("student");
  });

  it.each([{ name: "database error is returned, not thrown" }])("$name", async () => {
    const { db } = fakeDb({ data: null, error: DB_ERROR });
    expect(await listAllConsultations(db, { pageSize: 10 })).toEqual({
      ok: false,
      error: DB_ERROR,
    });
  });
});

describe("createConsultation", () => {
  const input = {
    firstName: "Ada",
    lastName: "L",
    reason: "Help",
    scheduledAt: "2030-01-01T10:00:00Z",
  };

  it.each([{ name: "inserts with student_id from the argument and returns the DTO" }])(
    "$name",
    async () => {
      const { db, calls } = fakeDb({ data: row(1), error: null });
      expect(await createConsultation(db, "u1", input)).toEqual({ ok: true, value: dto(1) });
      expect(calls[1]).toEqual([
        "insert",
        {
          student_id: "u1",
          first_name: "Ada",
          last_name: "L",
          reason: "Help",
          scheduled_at: "2030-01-01T10:00:00Z",
        },
      ]);
    },
  );

  it.each([{ name: "database error is returned" }])("$name", async () => {
    const { db } = fakeDb({ data: null, error: DB_ERROR });
    expect(await createConsultation(db, "u1", input)).toEqual({ ok: false, error: DB_ERROR });
  });
});

describe("updateConsultation", () => {
  it.each([
    { name: "complete", patch: { action: "complete" as const }, changes: { status: "completed" } },
    {
      name: "incomplete",
      patch: { action: "incomplete" as const },
      changes: { status: "scheduled" },
    },
    { name: "cancel", patch: { action: "cancel" as const }, changes: { status: "cancelled" } },
    {
      name: "reschedule",
      patch: { action: "reschedule" as const, scheduledAt: "2031-01-01T10:00:00Z" },
      changes: { scheduled_at: "2031-01-01T10:00:00Z" },
    },
  ])("$name writes only its change, scoped to id and student", async ({ patch, changes }) => {
    const { db, calls } = fakeDb({ data: row(1), error: null });
    expect(await updateConsultation(db, "u1", "id1", patch)).toEqual({ ok: true, value: dto(1) });
    expect(calls.slice(1, 4)).toEqual([
      ["update", changes],
      ["eq", "id", "id1"],
      ["eq", "student_id", "u1"],
    ]);
  });

  it.each([
    {
      name: "no matching row gives null",
      response: { data: null, error: null },
      expected: { ok: true, value: null },
    },
    {
      name: "database error is returned",
      response: { data: null, error: DB_ERROR },
      expected: { ok: false, error: DB_ERROR },
    },
  ])("$name", async ({ response, expected }) => {
    const { db } = fakeDb(response);
    expect(await updateConsultation(db, "u1", "id1", { action: "cancel" })).toEqual(expected);
  });
});
