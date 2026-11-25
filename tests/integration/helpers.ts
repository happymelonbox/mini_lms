import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import type { Database } from "@/lib/database.types";

import { PATCH } from "@/app/api/consultations/[id]/route";
import { POST } from "@/app/api/consultations/route";

// setup.ts swaps lib/supabase/server's cookie based createClient() for whatever is stored here,
// so handler + service + RLS + DB triggers all run for real against a real supabase-js client.
export const current = { client: null as unknown };

export type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
export type Actor = "student" | "student2" | "admin" | "anon";
type TestInit = Omit<RequestInit, "body"> & { body?: unknown };

export const newClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export const clients = {} as Record<Actor, SupabaseClient<Database>>;

// Students are fresh users per run (the signup trigger makes them students), so the seeded demo
// data is never touched. The DB allows 10 bookings per student per minute, so a student is swapped
// for a new one before reaching that.
const PASSWORD = "Password123!";
const MAX_CREATES = 8;
const created = { student: 0, student2: 0 };

export async function freshStudent(actor: "student" | "student2") {
  const client = newClient();
  const { error } = await client.auth.signUp({
    email: `it-${crypto.randomUUID()}@example.test`,
    password: PASSWORD,
  });
  if (error) throw new Error(`signup failed: ${error.message}`);
  clients[actor] = client;
  created[actor] = 0;
}

// Call from beforeAll in every test file: each file has its own module state and its own users.
export async function setupClients() {
  clients.anon = newClient();
  await freshStudent("student");
  await freshStudent("student2");
  clients.admin = newClient(); // the seeded admin is read-only here: nothing in these files writes as admin
  const { error } = await clients.admin.auth.signInWithPassword({
    email: "admin@example.com",
    password: PASSWORD,
  });
  if (error) throw new Error("seed login failed for admin");
}

export const ORIGIN = process.env.APP_ORIGIN!;
export const JSON_HEADERS = { origin: ORIGIN, "content-type": "application/json" };
export const BAD_ORIGIN = { ...JSON_HEADERS, origin: "http://evil.example" };
export const TEXT_PLAIN = { origin: ORIGIN, "content-type": "text/plain" };
export const NIL_UUID = "00000000-0000-4000-8000-000000000000";
export const future = (days = 3) => new Date(Date.now() + days * 86_400_000).toISOString();
export const valid = () => ({
  firstName: "Test",
  lastName: "Student",
  reason: "Integration test",
  scheduledAt: future(),
});

export const DTO_KEYS = [
  "createdAt",
  "firstName",
  "id",
  "lastName",
  "reason",
  "scheduledAt",
  "status",
  "updatedAt",
];

export async function call(actor: Actor, fn: Handler, url: string, init: TestInit = {}, id = "") {
  current.client = clients[actor];
  const body =
    init.body !== undefined && typeof init.body !== "string"
      ? JSON.stringify(init.body)
      : (init.body as string | undefined);
  const res = await fn(new Request(`http://localhost:3000${url}`, { ...init, body }), {
    params: Promise.resolve({ id }),
  });
  return { res, body: await res.json() };
}

export async function create(actor: "student" | "student2" = "student", over = {}) {
  if (created[actor] >= MAX_CREATES) await freshStudent(actor);
  const r = await call(actor, POST, "/api/consultations", {
    method: "POST",
    headers: JSON_HEADERS,
    body: { ...valid(), ...over },
  });
  expect(r.res.status).toBe(201);
  created[actor]++;
  return r.body.id as string;
}

export const patch = (actor: Actor, id: string, body: unknown, headers = JSON_HEADERS) =>
  call(actor, PATCH, `/api/consultations/${id}`, { method: "PATCH", headers, body }, id);
