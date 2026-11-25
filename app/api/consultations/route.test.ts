import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/respond";
import type { Database } from "@/lib/database.types";
import { consultation, dbError, listPage, users } from "@/tests/fixtures";
import { createConsultation, listOwnConsultations } from "@/lib/consultations/service";
import { GET, POST } from "./route";

vi.mock("@/lib/api/auth");
vi.mock("@/lib/consultations/service");
const m = {
  authenticate: vi.mocked(authenticate),
  list: vi.mocked(listOwnConsultations),
  create: vi.mocked(createConsultation),
};

const ORIGIN = "http://app.test";
const SUPABASE = createClient<Database>("http://sb.test", "key"); // real client object, never called
const DTO = consultation({ id: "c1", firstName: "Ada" });
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const VALID_BODY = { firstName: "Ada", lastName: "L", reason: "Help", scheduledAt: FUTURE };

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://app.test/api/consultations", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const rejectAuth = (status: number, code: string) => () =>
  m.authenticate.mockResolvedValue({ response: errorResponse(status, code, "x") });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", ORIGIN);
  m.authenticate.mockResolvedValue({ supabase: SUPABASE, user: users.student });
});

describe("GET /api/consultations", () => {
  it.each([
    {
      name: "signed out",
      setup: rejectAuth(401, "unauthorized"),
      url: "http://app.test/api/consultations",
      status: 401,
      body: { error: { code: "unauthorized" } },
    },
    {
      name: "wrong role",
      setup: rejectAuth(403, "forbidden"),
      url: "http://app.test/api/consultations",
      status: 403,
      body: { error: { code: "forbidden" } },
    },
    {
      name: "bad query passes the guard response through",
      setup: () => {},
      url: "http://app.test/api/consultations?pageSize=0",
      status: 400,
      body: { error: { code: "validation_error" } },
    },
    {
      name: "success returns the page plus pageSize",
      setup: () => m.list.mockResolvedValue(listPage([DTO], "n")),
      url: "http://app.test/api/consultations?pageSize=5",
      status: 200,
      body: { data: [DTO], nextCursor: "n", prevCursor: null, pageSize: 5 },
    },
    {
      name: "rate limit error maps to 429",
      setup: () => m.list.mockResolvedValue({ ok: false, error: dbError("P0001", "rate_limited") }),
      url: "http://app.test/api/consultations",
      status: 429,
      body: { error: { code: "rate_limited" } },
    },
  ])("$name", async ({ setup, url, status, body }) => {
    setup();
    const res = await GET(new Request(url));
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject(body);
  });

  it.each([{ name: "requires the student role and scopes the list to that student" }])(
    "$name",
    async () => {
      m.list.mockResolvedValue(listPage([]));
      await GET(new Request("http://app.test/api/consultations"));
      expect(m.authenticate).toHaveBeenCalledWith("student");
      expect(m.list).toHaveBeenCalledExactlyOnceWith(SUPABASE, users.student.id, { pageSize: 10 });
    },
  );
});

describe("POST /api/consultations", () => {
  it.each([
    {
      name: "signed out",
      setup: rejectAuth(401, "unauthorized"),
      req: () => post(VALID_BODY),
      status: 401,
      body: { error: { code: "unauthorized" } },
    },
    {
      name: "wrong role",
      setup: rejectAuth(403, "forbidden"),
      req: () => post(VALID_BODY),
      status: 403,
      body: { error: { code: "forbidden" } },
    },
    {
      name: "guard failure (foreign origin) passes through",
      setup: () => {},
      req: () => post(VALID_BODY, { origin: "http://evil.test" }),
      status: 403,
      body: { error: { code: "forbidden_origin" } },
    },
    {
      name: "invalid body is a 400 with field errors",
      setup: () => {},
      req: () => post({ ...VALID_BODY, firstName: "" }),
      status: 400,
      body: { error: { code: "validation_error", fields: { firstName: ["Required"] } } },
    },
    {
      name: "success returns 201 with the DTO",
      setup: () => m.create.mockResolvedValue({ ok: true, value: DTO }),
      req: () => post(VALID_BODY),
      status: 201,
      body: DTO,
    },
    {
      name: "past-date trigger error maps to 400 on scheduledAt",
      setup: () =>
        m.create.mockResolvedValue({
          ok: false,
          error: dbError("P0001", "scheduled_at_must_be_future"),
        }),
      req: () => post(VALID_BODY),
      status: 400,
      body: { error: { fields: { scheduledAt: ["Must be in the future"] } } },
    },
    {
      name: "unknown db error maps to 500 without leaking text",
      setup: () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        m.create.mockResolvedValue({ ok: false, error: dbError("XX000", "secret") });
      },
      req: () => post(VALID_BODY),
      status: 500,
      body: { error: { code: "internal_error", message: "Something went wrong" } },
    },
  ])("$name", async ({ setup, req, status, body }) => {
    setup();
    const res = await POST(req());
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject(body);
  });

  it.each([{ name: "student id comes from the token and the parsed body is passed on" }])(
    "$name",
    async () => {
      m.create.mockResolvedValue({ ok: true, value: DTO });
      await POST(post(VALID_BODY));
      expect(m.authenticate).toHaveBeenCalledWith("student");
      expect(m.create).toHaveBeenCalledExactlyOnceWith(SUPABASE, users.student.id, VALID_BODY);
    },
  );
});
