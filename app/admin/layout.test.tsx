import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import AdminLayout from "./layout";

beforeEach(() => vi.clearAllMocks());

describe("AdminLayout", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "role-less user is sent home", user: { id: "u1", role: null, email: "a@b.c" } },
    { name: "student is sent home", user: { id: "u1", role: "student", email: "a@b.c" } },
  ])("$name", async ({ user }) => {
    getCurrentUser.mockResolvedValue(user);
    await expect(AdminLayout({ children: <p>secret</p> })).rejects.toThrow("REDIRECT:/");
  });

  it.each([
    {
      name: "admin sees the child page inside the admin header",
      user: { id: "u1", role: "admin", email: "boss@example.com" },
    },
  ])("$name", async ({ user }) => {
    getCurrentUser.mockResolvedValue(user);
    render(await AdminLayout({ children: <p>secret</p> }));
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
