import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import Home from "./page";

beforeEach(() => vi.clearAllMocks());

describe("Home role router", () => {
  it.each([
    { name: "signed out goes to log in", user: null, to: "/auth/login" },
    {
      name: "signed in without a role goes to the error page",
      user: { id: "u1", role: null, email: "a@b.c" },
      to: "/auth/error?error=no_role",
    },
    {
      name: "admin goes to the admin page",
      user: { id: "u1", role: "admin", email: "a@b.c" },
      to: "/admin",
    },
    {
      name: "student goes to the dashboard",
      user: { id: "u1", role: "student", email: "a@b.c" },
      to: "/dashboard",
    },
  ])("$name", async ({ user, to }) => {
    getCurrentUser.mockResolvedValue(user);
    await expect(Home()).rejects.toThrow(`REDIRECT:${to}`);
  });
});
