import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { users } from "@/tests/fixtures";
import { nav } from "@/tests/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

vi.mock("@/lib/auth/current-user");

import AdminLayout from "./layout";

beforeEach(() => {
  nav.pathname = "/admin";
});

describe("AdminLayout", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "role-less user is sent home", user: users.roleless },
    { name: "student is sent home", user: users.student },
  ])("$name", async ({ user }) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    await expect(AdminLayout({ children: <p>secret</p> })).rejects.toEqual(new Error("REDIRECT:/"));
  });

  it.each([{ name: "admin sees the child page inside the admin header" }])("$name", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(users.admin);
    render(await AdminLayout({ children: <p>secret</p> }));
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
