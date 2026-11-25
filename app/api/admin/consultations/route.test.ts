import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorResponse } from "@/lib/api/respond";
import { GET } from "./route";

const m = vi.hoisted(() => ({ authenticate: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ authenticate: m.authenticate }));
vi.mock("@/lib/consultations/service", () => ({ listAllConsultations: m.list }));

const SUPABASE = { tag: "supabase" };
const DTO = { id: "c1", firstName: "Ada" };
const URL = "http://app.test/api/admin/consultations";

const rejectAuth = (status: number, code: string) => () =>
  m.authenticate.mockResolvedValue({ response: errorResponse(status, code, "x") });

beforeEach(() => {
  vi.resetAllMocks();
  m.authenticate.mockResolvedValue({ supabase: SUPABASE, user: { id: "a", role: "admin" } });
});

describe("GET /api/admin/consultations", () => {
  it.each([
    {
      name: "signed out",
      setup: rejectAuth(401, "unauthorized"),
      url: URL,
      status: 401,
      body: { error: { code: "unauthorized" } },
    },
    {
      name: "wrong role",
      setup: rejectAuth(403, "forbidden"),
      url: URL,
      status: 403,
      body: { error: { code: "forbidden" } },
    },
    {
      name: "bad query passes the guard response through",
      setup: () => {},
      url: `${URL}?pageSize=999`,
      status: 400,
      body: { error: { code: "validation_error" } },
    },
    {
      name: "success returns the page plus pageSize",
      setup: () =>
        m.list.mockResolvedValue({
          ok: true,
          value: { data: [DTO], nextCursor: null, prevCursor: "p" },
        }),
      url: `${URL}?pageSize=3`,
      status: 200,
      body: { data: [DTO], nextCursor: null, prevCursor: "p", pageSize: 3 },
    },
    {
      name: "db error maps to 500",
      setup: () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        m.list.mockResolvedValue({ ok: false, error: { code: "XX000", message: "boom" } });
      },
      url: URL,
      status: 500,
      body: { error: { code: "internal_error" } },
    },
  ])("$name", async ({ setup, url, status, body }) => {
    setup();
    const res = await GET(new Request(url));
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject(body);
  });

  it.each([{ name: "requires the admin role and lists across all students" }])(
    "$name",
    async () => {
      m.list.mockResolvedValue({
        ok: true,
        value: { data: [], nextCursor: null, prevCursor: null },
      });
      await GET(new Request(URL));
      expect(m.authenticate).toHaveBeenCalledWith("admin");
      expect(m.list).toHaveBeenCalledWith(SUPABASE, expect.objectContaining({ pageSize: 10 }));
    },
  );
});
