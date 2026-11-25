import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const listAllConsultations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/consultations/service", () => ({ listAllConsultations }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import AdminPage from "./page";

const admin = { id: "admin-1", role: "admin", email: "boss@example.com" };
const row = (id: string, firstName: string, reason: string, status: string) => ({
  id,
  firstName,
  lastName: "Lee",
  reason,
  scheduledAt: "2999-01-01T10:00:00.000Z",
  status,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
});
const page = (data: unknown[], nextCursor: string | null, prevCursor: string | null) => ({
  ok: true,
  value: { data, nextCursor, prevCursor },
});
const validCursor = btoa("2030-01-01T10:00:00Z|22222222-2222-4222-8222-222222222222")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

async function renderPage(searchParams: { after?: string; before?: string } = {}) {
  render(await AdminPage({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => vi.clearAllMocks());

describe("AdminPage access", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "student is sent home", user: { id: "s1", role: "student", email: "a@b.c" } },
    { name: "role-less user is sent home", user: { id: "u1", role: null, email: "a@b.c" } },
  ])("$name", async ({ user }) => {
    getCurrentUser.mockResolvedValue(user);
    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/");
    expect(listAllConsultations).not.toHaveBeenCalled();
  });
});

describe("AdminPage as an admin", () => {
  beforeEach(() => getCurrentUser.mockResolvedValue(admin));

  it.each([
    {
      name: "shows one table row per consultation with the student's name",
      searchParams: {},
      result: page(
        [
          row("11111111-1111-4111-8111-111111111111", "Ann", "Essay help", "scheduled"),
          row("33333333-3333-4333-8333-333333333333", "Bob", "Exam prep", "cancelled"),
        ],
        null,
        null,
      ),
      visible: [/Ann Lee/, /Essay help/, /Bob Lee/, /Exam prep/],
      rows: 3, // header row plus two consultations
    },
    {
      name: "shows the empty state on the first page",
      searchParams: {},
      result: page([], null, null),
      visible: [/Nothing coming up yet/],
      rows: 0,
    },
    {
      name: "offers a way back on an empty later page",
      searchParams: { after: validCursor },
      result: page([], null, "p"),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      rows: 0,
    },
    {
      name: "offers a way back on an empty earlier page",
      searchParams: { before: validCursor },
      result: page([], "n", null),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      rows: 0,
    },
    {
      name: "shows an alert when the list cannot be loaded",
      searchParams: {},
      result: { ok: false, error: { message: "boom" } },
      visible: [/couldn.t load the consultations/],
      rows: 0,
    },
  ])("$name", async ({ searchParams, result, visible, rows }) => {
    listAllConsultations.mockResolvedValue(result);
    await renderPage(searchParams);
    visible.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
    expect(screen.queryAllByRole("row")).toHaveLength(rows);
  });

  it.each([
    {
      name: "links Earlier and Later with the cursors from the service",
      result: page([row("1", "Ann", "Essay", "scheduled")], "next-c", "prev-c"),
      earlier: "/admin?before=prev-c",
      later: "/admin?after=next-c",
    },
    {
      name: "disables both when it is the only page",
      result: page([row("1", "Ann", "Essay", "scheduled")], null, null),
      earlier: null,
      later: null,
    },
  ])("$name", async ({ result, earlier, later }) => {
    listAllConsultations.mockResolvedValue(result);
    await renderPage();
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    for (const [label, href] of [
      ["Earlier", earlier],
      ["Later", later],
    ] as const) {
      if (href) {
        expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
      } else {
        expect(within(nav).getByRole("button", { name: label })).toBeDisabled();
      }
    }
  });

  it.each([
    {
      name: "passes a valid before cursor to the service",
      searchParams: { before: validCursor },
      cursors: {
        before: { scheduledAt: "2030-01-01T10:00:00Z", id: "22222222-2222-4222-8222-222222222222" },
      },
    },
    {
      name: "ignores an invalid cursor and shows the first page",
      searchParams: { after: "!!" },
      cursors: {},
    },
  ])("$name", async ({ searchParams, cursors }) => {
    listAllConsultations.mockResolvedValue(page([], null, null));
    await renderPage(searchParams);
    const [, query] = listAllConsultations.mock.calls[0];
    expect({ after: query.after, before: query.before }).toEqual(cursors);
  });
});
