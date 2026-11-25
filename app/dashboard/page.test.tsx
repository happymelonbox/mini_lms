import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const listOwnConsultations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/consultations/service", () => ({ listOwnConsultations }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

import DashboardPage from "./page";

const student = { id: "student-1", role: "student", email: "stu@example.com" };
const consultation = {
  id: "11111111-1111-4111-8111-111111111111",
  firstName: "Ann",
  lastName: "Lee",
  reason: "Help with my essay",
  scheduledAt: "2999-01-01T10:00:00.000Z",
  status: "scheduled",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
};
const page = (data: unknown[], nextCursor: string | null, prevCursor: string | null) => ({
  ok: true,
  value: { data, nextCursor, prevCursor },
});
// base64url of "2030-01-01T10:00:00Z|<uuid>", the shape parseCursors accepts.
const validCursor = btoa("2030-01-01T10:00:00Z|22222222-2222-4222-8222-222222222222")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

async function renderPage(searchParams: { after?: string; before?: string } = {}) {
  render(await DashboardPage({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => vi.clearAllMocks());

describe("DashboardPage access", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "admin is sent home", user: { id: "a1", role: "admin", email: "a@b.c" } },
    { name: "role-less user is sent home", user: { id: "u1", role: null, email: "a@b.c" } },
  ])("$name", async ({ user }) => {
    getCurrentUser.mockResolvedValue(user);
    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/",
    );
    expect(listOwnConsultations).not.toHaveBeenCalled();
  });
});

describe("DashboardPage as a student", () => {
  beforeEach(() => getCurrentUser.mockResolvedValue(student));

  it.each([
    {
      name: "lists own consultations with a link to book",
      searchParams: {},
      result: page([consultation], null, null),
      visible: [/Help with my essay/, /Ann Lee/],
      absent: [/Nothing coming up yet/, /couldn.t load/],
    },
    {
      name: "shows the empty state on the first page",
      searchParams: {},
      result: page([], null, null),
      visible: [/Nothing coming up yet/],
      absent: [/Nothing more this way/],
    },
    {
      name: "offers a way back on an empty later page",
      searchParams: { after: validCursor },
      result: page([], null, "p"),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      absent: [/Nothing coming up yet/],
    },
    {
      name: "offers a way back on an empty earlier page",
      searchParams: { before: validCursor },
      result: page([], "n", null),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      absent: [/Nothing coming up yet/],
    },
    {
      name: "shows an alert when the list cannot be loaded",
      searchParams: {},
      result: { ok: false, error: { message: "boom" } },
      visible: [/couldn.t load your consultations/],
      absent: [/Nothing coming up yet/],
    },
  ])("$name", async ({ searchParams, result, visible, absent }) => {
    listOwnConsultations.mockResolvedValue(result);
    await renderPage(searchParams);
    expect(screen.getByRole("link", { name: "Book a consultation" })).toHaveAttribute(
      "href",
      "/dashboard/book",
    );
    visible.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
    absent.forEach((text) => expect(screen.queryByText(text)).not.toBeInTheDocument());
  });

  it.each([
    {
      name: "links Earlier and Later with the cursors from the service",
      result: page([consultation], "next-c", "prev-c"),
      earlier: "/dashboard?before=prev-c",
      later: "/dashboard?after=next-c",
    },
    {
      name: "disables Earlier when there is nothing before",
      result: page([consultation], "next-c", null),
      earlier: null,
      later: "/dashboard?after=next-c",
    },
    {
      name: "disables Later when there is nothing after",
      result: page([consultation], null, "prev-c"),
      earlier: "/dashboard?before=prev-c",
      later: null,
    },
  ])("$name", async ({ result, earlier, later }) => {
    listOwnConsultations.mockResolvedValue(result);
    await renderPage();
    for (const [label, href] of [
      ["Earlier", earlier],
      ["Later", later],
    ] as const) {
      if (href) expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
      else expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });

  it.each([
    {
      name: "passes a valid after cursor to the service",
      searchParams: { after: validCursor },
      cursors: {
        after: { scheduledAt: "2030-01-01T10:00:00Z", id: "22222222-2222-4222-8222-222222222222" },
      },
    },
    {
      name: "ignores an invalid cursor and shows the first page",
      searchParams: { after: "!!" },
      cursors: {},
    },
    {
      name: "ignores both cursors when both are given",
      searchParams: { after: validCursor, before: validCursor },
      cursors: {},
    },
  ])("$name", async ({ searchParams, cursors }) => {
    listOwnConsultations.mockResolvedValue(page([], null, null));
    await renderPage(searchParams);
    const [, userId, query] = listOwnConsultations.mock.calls[0];
    expect(userId).toBe("student-1");
    expect({ after: query.after, before: query.before }).toEqual(cursors);
  });
});
