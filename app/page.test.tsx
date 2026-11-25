import { describe, expect, it, vi } from "vitest";
import { users } from "@/tests/fixtures";
import { getCurrentUser } from "@/lib/auth/current-user";

vi.mock("@/lib/auth/current-user");

import Home from "./page";

describe("Home role router", () => {
  it.each([
    { name: "signed out goes to log in", user: null, to: "/auth/login" },
    {
      name: "signed in without a role goes to the error page",
      user: users.roleless,
      to: "/auth/error?error=no_role",
    },
    { name: "admin goes to the admin page", user: users.admin, to: "/admin" },
    { name: "student goes to the dashboard", user: users.student, to: "/dashboard" },
  ])("$name", async ({ user, to }) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    await expect(Home()).rejects.toEqual(new Error(`REDIRECT:${to}`));
  });
});
