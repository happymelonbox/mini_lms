import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { users } from "@/tests/fixtures";
import { nav } from "@/tests/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

vi.mock("@/lib/auth/current-user");

import DashboardLayout from "./layout";

beforeEach(() => {
  nav.pathname = "/dashboard";
});

describe("DashboardLayout", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "role-less user is sent home", user: users.roleless },
    { name: "admin is sent home", user: users.admin },
  ])("$name", async ({ user }) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    await expect(DashboardLayout({ children: <p>mine</p> })).rejects.toEqual(
      new Error("REDIRECT:/"),
    );
  });

  it.each([{ name: "student sees the child page with the student nav" }])("$name", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(users.student);
    render(await DashboardLayout({ children: <p>mine</p> }));
    expect(screen.getByText("mine")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/dashboard/book");
  });
});
