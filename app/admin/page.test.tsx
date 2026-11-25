import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_SIZE, encodeCursor } from "@/lib/consultations/schema";
import { consultation, dbError, listPage, users } from "@/tests/fixtures";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listAllConsultations } from "@/lib/consultations/service";

vi.mock("@/lib/auth/current-user");
vi.mock("@/lib/consultations/service");

import AdminPage from "./page";

const CURSOR = { scheduledAt: "2030-01-01T10:00:00Z", id: "22222222-2222-4222-8222-222222222222" };
const validCursor = encodeCursor(CURSOR.scheduledAt, CURSOR.id);

async function renderPage(searchParams: { after?: string; before?: string } = {}) {
  render(await AdminPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("AdminPage access", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "student is sent home", user: users.student },
    { name: "role-less user is sent home", user: users.roleless },
  ])("$name", async ({ user }) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toEqual(
      new Error("REDIRECT:/"),
    );
    expect(listAllConsultations).not.toHaveBeenCalled();
  });
});

describe("AdminPage as an admin", () => {
  beforeEach(() => vi.mocked(getCurrentUser).mockResolvedValue(users.admin));

  it.each([
    {
      name: "shows one table row per consultation with the student's name",
      searchParams: {},
      result: listPage([
        consultation(),
        consultation({
          id: "33333333-3333-4333-8333-333333333333",
          firstName: "Bob",
          reason: "Exam prep",
          status: "cancelled",
        }),
      ]),
      visible: [/Ann Lee/, /Help with my essay/, /Bob Lee/, /Exam prep/],
      rows: 3, // header row plus two consultations
    },
    {
      name: "shows the empty state on the first page",
      searchParams: {},
      result: listPage([]),
      visible: [/Nothing coming up yet/],
      rows: 0,
    },
    {
      name: "offers a way back on an empty later page",
      searchParams: { after: validCursor },
      result: listPage([], null, "p"),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      rows: 0,
    },
    {
      name: "offers a way back on an empty earlier page",
      searchParams: { before: validCursor },
      result: listPage([], "n"),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      rows: 0,
    },
    {
      name: "shows an alert when the list cannot be loaded",
      searchParams: {},
      result: { ok: false as const, error: dbError() },
      visible: [/couldn.t load the consultations/],
      rows: 0,
    },
  ])("$name", async ({ searchParams, result, visible, rows }) => {
    vi.mocked(listAllConsultations).mockResolvedValue(result);
    await renderPage(searchParams);
    visible.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
    expect(screen.queryAllByRole("row")).toHaveLength(rows);
  });

  it.each([
    {
      name: "links Earlier and Later with the cursors from the service",
      result: listPage([consultation()], "next-c", "prev-c"),
    },
  ])("$name", async ({ result }) => {
    vi.mocked(listAllConsultations).mockResolvedValue(result);
    await renderPage();
    expect(screen.getByRole("link", { name: "Earlier" })).toHaveAttribute(
      "href",
      "/admin?before=prev-c",
    );
    expect(screen.getByRole("link", { name: "Later" })).toHaveAttribute(
      "href",
      "/admin?after=next-c",
    );
  });

  it.each([
    {
      name: "passes a valid before cursor to the service",
      searchParams: { before: validCursor },
      query: { before: CURSOR, pageSize: DEFAULT_PAGE_SIZE },
    },
  ])("$name", async ({ searchParams, query }) => {
    vi.mocked(listAllConsultations).mockResolvedValue(listPage([]));
    await renderPage(searchParams);
    expect(listAllConsultations).toHaveBeenCalledExactlyOnceWith({}, query);
  });
});
