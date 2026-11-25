import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/current-user";
import { nav } from "@/tests/navigation";
import { AppHeader } from "./app-header";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: () => {} }) }));

const STUDENT_LINKS: [string, string][] = [
  ["Consultations", "/dashboard"],
  ["Book", "/dashboard/book"],
];

it.each<{
  name: string;
  role: Role;
  pathname: string;
  links: [string, string][];
  current: string | null;
}>([
  {
    name: "student on dashboard",
    role: "student",
    pathname: "/dashboard",
    links: STUDENT_LINKS,
    current: "Consultations",
  },
  {
    name: "student on book",
    role: "student",
    pathname: "/dashboard/book",
    links: STUDENT_LINKS,
    current: "Book",
  },
  { name: "admin has no nav", role: "admin", pathname: "/admin", links: [], current: null },
])("AppHeader $name", ({ role, pathname, links, current }) => {
  nav.pathname = pathname;
  render(<AppHeader role={role} email="ann@example.com" />);
  expect(screen.getByRole("link", { name: "Mini-LMS" })).toHaveAttribute("href", "/");
  expect(screen.getByText("ann@example.com")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  if (links.length === 0) {
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    return;
  }
  const main = within(screen.getByRole("navigation", { name: "Main" }));
  expect(main.getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual(
    links,
  );
  expect(main.getByRole("link", { current: "page" })).toHaveTextContent(current ?? "");
});
