import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_SIZE, encodeCursor } from "@/lib/consultations/schema";
import { consultation, dbError, listPage, users } from "@/tests/fixtures";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listOwnConsultations } from "@/lib/consultations/service";

vi.mock("@/lib/auth/current-user");
vi.mock("@/lib/consultations/service");

import DashboardPage from "./page";

const CURSOR = { scheduledAt: "2030-01-01T10:00:00Z", id: "22222222-2222-4222-8222-222222222222" };
const validCursor = encodeCursor(CURSOR.scheduledAt, CURSOR.id);

async function renderPage(searchParams: { after?: string; before?: string } = {}) {
  render(await DashboardPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("DashboardPage access", () => {
  it.each([
    { name: "signed out is sent home", user: null },
    { name: "admin is sent home", user: users.admin },
    { name: "role-less user is sent home", user: users.roleless },
  ])("$name", async ({ user }) => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).rejects.toEqual(
      new Error("REDIRECT:/"),
    );
    expect(listOwnConsultations).not.toHaveBeenCalled();
  });
});

describe("DashboardPage as a student", () => {
  beforeEach(() => vi.mocked(getCurrentUser).mockResolvedValue(users.student));

  it.each([
    {
      name: "lists own consultations with a link to book",
      searchParams: {},
      result: listPage([consultation()]),
      visible: [/Help with my essay/, /Ann Lee/],
      absent: [/Nothing coming up yet/, /couldn.t load/],
    },
    {
      name: "shows the empty state on the first page",
      searchParams: {},
      result: listPage([]),
      visible: [/Nothing coming up yet/],
      absent: [/Nothing more this way/],
    },
    {
      name: "offers a way back on an empty later page",
      searchParams: { after: validCursor },
      result: listPage([], null, "p"),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      absent: [/Nothing coming up yet/],
    },
    {
      name: "offers a way back on an empty earlier page",
      searchParams: { before: validCursor },
      result: listPage([], "n"),
      visible: [/Nothing more this way/, /Back to what.s coming up/],
      absent: [/Nothing coming up yet/],
    },
    {
      name: "shows an alert when the list cannot be loaded",
      searchParams: {},
      result: { ok: false as const, error: dbError() },
      visible: [/couldn.t load your consultations/],
      absent: [/Nothing coming up yet/],
    },
  ])("$name", async ({ searchParams, result, visible, absent }) => {
    vi.mocked(listOwnConsultations).mockResolvedValue(result);
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
      result: listPage([consultation()], "next-c", "prev-c"),
    },
  ])("$name", async ({ result }) => {
    vi.mocked(listOwnConsultations).mockResolvedValue(result);
    await renderPage();
    expect(screen.getByRole("link", { name: "Earlier" })).toHaveAttribute(
      "href",
      "/dashboard?before=prev-c",
    );
    expect(screen.getByRole("link", { name: "Later" })).toHaveAttribute(
      "href",
      "/dashboard?after=next-c",
    );
  });

  it.each([
    {
      name: "passes a valid after cursor to the service",
      searchParams: { after: validCursor },
      query: { after: CURSOR, pageSize: DEFAULT_PAGE_SIZE },
    },
  ])("$name", async ({ searchParams, query }) => {
    vi.mocked(listOwnConsultations).mockResolvedValue(listPage([]));
    await renderPage(searchParams);
    expect(listOwnConsultations).toHaveBeenCalledExactlyOnceWith({}, "student-1", query);
  });
});
