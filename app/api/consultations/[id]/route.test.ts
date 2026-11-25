import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorResponse } from "@/lib/api/respond";
import { PATCH } from "./route";

const m = vi.hoisted(() => ({ authenticate: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ authenticate: m.authenticate }));
vi.mock("@/lib/consultations/service", () => ({ updateConsultation: m.update }));

const ORIGIN = "http://app.test";
const SUPABASE = { tag: "supabase" };
const USER = { id: "11111111-1111-4111-8111-111111111111", role: "student", email: "a@b.c" };
const ID = "22222222-2222-4222-8222-222222222222";
const DTO = { id: ID, status: "completed" };

const patch = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://app.test/api/consultations/${ID}`, {
    method: "PATCH",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const call = (req: Request, id = ID) => PATCH(req, { params: Promise.resolve({ id }) });

const rejectAuth = (status: number, code: string) => () =>
  m.authenticate.mockResolvedValue({ response: errorResponse(status, code, "x") });

beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_ORIGIN = ORIGIN;
  m.authenticate.mockResolvedValue({ supabase: SUPABASE, user: USER });
});

describe("PATCH /api/consultations/[id]", () => {
  it.each([
    {
      name: "signed out",
      setup: rejectAuth(401, "unauthorized"),
      id: ID,
      req: () => patch({ action: "complete" }),
      status: 401,
      body: { error: { code: "unauthorized" } },
    },
    {
      name: "wrong role",
      setup: rejectAuth(403, "forbidden"),
      id: ID,
      req: () => patch({ action: "complete" }),
      status: 403,
      body: { error: { code: "forbidden" } },
    },
    {
      name: "guard failure (foreign origin) passes through",
      setup: () => {},
      id: ID,
      req: () => patch({ action: "complete" }, { origin: "http://evil.test" }),
      status: 403,
      body: { error: { code: "forbidden_origin" } },
    },
    {
      name: "foreign origin wins over a non-uuid id (403 before 404)",
      setup: () => {},
      id: "not-a-uuid",
      req: () => patch({ action: "complete" }, { origin: "http://evil.test" }),
      status: 403,
      body: { error: { code: "forbidden_origin" } },
    },
    {
      name: "non-uuid id looks like an unknown one",
      setup: () => {},
      id: "not-a-uuid",
      req: () => patch({ action: "complete" }),
      status: 404,
      body: { error: { code: "not_found" } },
    },
    {
      name: "unknown action is a 400",
      setup: () => {},
      id: ID,
      req: () => patch({ action: "explode" }),
      status: 400,
      body: { error: { code: "validation_error" } },
    },
    {
      name: "success returns the updated DTO",
      setup: () => m.update.mockResolvedValue({ ok: true, value: DTO }),
      id: ID,
      req: () => patch({ action: "complete" }),
      status: 200,
      body: DTO,
    },
    {
      name: "no matching row (missing or not yours) is a 404",
      setup: () => m.update.mockResolvedValue({ ok: true, value: null }),
      id: ID,
      req: () => patch({ action: "cancel" }),
      status: 404,
      body: { error: { code: "not_found" } },
    },
    {
      name: "state-machine trigger error maps to 409",
      setup: () =>
        m.update.mockResolvedValue({
          ok: false,
          error: { code: "P0001", message: "invalid_status_transition" },
        }),
      id: ID,
      req: () => patch({ action: "complete" }),
      status: 409,
      body: { error: { code: "conflict" } },
    },
  ])("$name", async ({ setup, id, req, status, body }) => {
    setup();
    const res = await call(req(), id);
    expect(res.status).toBe(status);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject(body);
  });

  it.each([{ name: "updates only the signed-in student's row with the parsed patch" }])(
    "$name",
    async () => {
      m.update.mockResolvedValue({ ok: true, value: DTO });
      await call(patch({ action: "complete" }));
      expect(m.update).toHaveBeenCalledWith(SUPABASE, USER.id, ID, { action: "complete" });
    },
  );
});
