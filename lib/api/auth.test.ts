import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "./auth";

type Claims = { data: { claims: { sub?: string; user_role?: string; email?: string } } | null };

const m = vi.hoisted(() => {
  const getClaims = vi.fn<() => Promise<Claims>>();
  return {
    getClaims,
    createClient: vi.fn<() => Promise<{ auth: { getClaims: typeof getClaims } }>>(),
  };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));

const SUPABASE = { auth: { getClaims: m.getClaims } };

beforeEach(() => {
  vi.resetAllMocks();
  m.createClient.mockResolvedValue(SUPABASE);
});

describe("authenticate", () => {
  it.each([
    {
      name: "no claims",
      claims: null,
      role: "student" as const,
      status: 401,
      code: "unauthorized",
    },
    {
      name: "claims without sub",
      claims: { user_role: "student" },
      role: "student" as const,
      status: 401,
      code: "unauthorized",
    },
    {
      name: "student asked for admin",
      claims: { sub: "u1", user_role: "student" },
      role: "admin" as const,
      status: 403,
      code: "forbidden",
    },
    {
      name: "admin asked for student",
      claims: { sub: "u1", user_role: "admin" },
      role: "student" as const,
      status: 403,
      code: "forbidden",
    },
    {
      name: "unknown role is forbidden",
      claims: { sub: "u1", user_role: "root" },
      role: "student" as const,
      status: 403,
      code: "forbidden",
    },
    {
      name: "missing role is forbidden",
      claims: { sub: "u1" },
      role: "admin" as const,
      status: 403,
      code: "forbidden",
    },
  ])("$name -> $status", async ({ claims, role, status, code }) => {
    m.getClaims.mockResolvedValue({ data: claims && { claims } });
    const result = await authenticate(role);
    if (!("response" in result)) throw new Error("expected a rejection");
    expect(result.response.status).toBe(status);
    expect(await result.response.json()).toMatchObject({ error: { code } });
  });

  it.each([
    { name: "student", role: "student" as const },
    { name: "admin", role: "admin" as const },
  ])("matching $name role returns the client and user", async ({ role }) => {
    m.getClaims.mockResolvedValue({
      data: { claims: { sub: "u1", user_role: role, email: "a@b.c" } },
    });
    expect(await authenticate(role)).toEqual({
      supabase: SUPABASE,
      user: { id: "u1", role, email: "a@b.c" },
    });
  });
});
