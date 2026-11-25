import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/respond";
import type { Database } from "@/lib/database.types";
import { consultation, dbError, listPage, users } from "@/tests/fixtures";
import { listAllConsultations } from "@/lib/consultations/service";
import { GET } from "./route";

vi.mock("@/lib/api/auth");
vi.mock("@/lib/consultations/service");
const m = { authenticate: vi.mocked(authenticate), list: vi.mocked(listAllConsultations) };

const SUPABASE = createClient<Database>("http://sb.test", "key"); // real client object, never called
const DTO = consultation({ id: "c1", firstName: "Ada" });
const URL = "http://app.test/api/admin/consultations";

const rejectAuth = (status: number, code: string) => () =>
  m.authenticate.mockResolvedValue({ response: errorResponse(status, code, "x") });

beforeEach(() => {
  vi.resetAllMocks();
  m.authenticate.mockResolvedValue({ supabase: SUPABASE, user: users.admin });
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
      setup: () => m.list.mockResolvedValue(listPage([DTO], null, "p")),
      url: `${URL}?pageSize=3`,
      status: 200,
      body: { data: [DTO], nextCursor: null, prevCursor: "p", pageSize: 3 },
    },
    {
      name: "db error maps to 500",
      setup: () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        m.list.mockResolvedValue({ ok: false, error: dbError() });
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
      m.list.mockResolvedValue(listPage([]));
      await GET(new Request(URL));
      expect(m.authenticate).toHaveBeenCalledWith("admin");
      expect(m.list).toHaveBeenCalledExactlyOnceWith(SUPABASE, { pageSize: 10 });
    },
  );
});
