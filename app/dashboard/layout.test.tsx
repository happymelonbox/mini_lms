import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import DashboardLayout from "./layout";

beforeEach(() => vi.clearAllMocks());

describe("DashboardLayout", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "role-less user is sent home", user: { id: "u1", role: null, email: "a@b.c" } },
    { name: "admin is sent home", user: { id: "u1", role: "admin", email: "a@b.c" } },
  ])("$name", async ({ user }) => {
    getCurrentUser.mockResolvedValue(user);
    await expect(DashboardLayout({ children: <p>mine</p> })).rejects.toThrow("REDIRECT:/");
  });

  it.each([
    {
      name: "student sees the child page with the student nav",
      user: { id: "u1", role: "student", email: "stu@example.com" },
    },
  ])("$name", async ({ user }) => {
    getCurrentUser.mockResolvedValue(user);
    render(await DashboardLayout({ children: <p>mine</p> }));
    expect(screen.getByText("mine")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/dashboard/book");
  });
});
