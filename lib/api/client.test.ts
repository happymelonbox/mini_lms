import { describe, expect, it, vi } from "vitest";
import { createConsultationRequest, patchConsultation } from "./client";

const reply = (status: number, body?: unknown) => async () =>
  new Response(body === undefined ? "<html>oops</html>" : JSON.stringify(body), { status });
const row = { id: "x", status: "scheduled" };
const input = {
  firstName: "A",
  lastName: "B",
  reason: "r",
  scheduledAt: "2030-01-01T10:00:00+00:00",
};

describe.each([
  {
    fn: "patchConsultation",
    call: (f: typeof fetch) => patchConsultation("x", { action: "cancel" }, f),
  },
  {
    fn: "createConsultationRequest",
    call: (f: typeof fetch) => createConsultationRequest(input, f),
  },
])("$fn result mapping", ({ call }) => {
  it.each([
    { name: "200", fetch: reply(200, row), want: { ok: true } },
    { name: "201", fetch: reply(201, row), want: { ok: true } },
    {
      name: "400 with fields",
      fetch: reply(400, {
        error: {
          code: "validation_error",
          message: "Invalid request",
          fields: { reason: ["Required"] },
        },
      }),
      want: {
        ok: false,
        status: 400,
        error: { message: "Invalid request", fields: { reason: ["Required"] } },
      },
    },
    {
      name: "401",
      fetch: reply(401, { error: { message: "Unauthorized" } }),
      want: { ok: false, status: 401, error: { message: "Unauthorized" } },
    },
    {
      name: "401 without body",
      fetch: reply(401),
      want: {
        ok: false,
        status: 401,
        error: { message: "Something went wrong. Please try again." },
      },
    },
    {
      name: "404",
      fetch: reply(404, { error: { message: "Not found" } }),
      want: { ok: false, status: 404, error: { message: "Not found" } },
    },
    {
      name: "409",
      fetch: reply(409, {
        error: { message: "This consultation cannot be changed in its current state" },
      }),
      want: {
        ok: false,
        status: 409,
        error: { message: "This consultation cannot be changed in its current state" },
      },
    },
    {
      name: "429",
      fetch: reply(429, { error: { message: "Too many requests" } }),
      want: { ok: false, status: 429, error: { message: "Too many requests" } },
    },
    {
      name: "429 without body",
      fetch: reply(429),
      want: {
        ok: false,
        status: 429,
        error: { message: "Something went wrong. Please try again." },
      },
    },
    {
      name: "500 hides server text",
      fetch: reply(500, { error: { message: "pg exploded" } }),
      want: {
        ok: false,
        status: 500,
        error: { message: "Something went wrong. Please try again." },
      },
    },
    {
      name: "network error",
      fetch: async () => {
        throw new TypeError("failed");
      },
      want: {
        ok: false,
        status: 0,
        error: { message: "Network error. Check your connection and try again." },
      },
    },
  ])("$name", async ({ fetch, want }) => {
    expect(await call(fetch as unknown as typeof globalThis.fetch)).toEqual(want);
  });
});

describe("request shape", () => {
  it.each([
    {
      name: "patch",
      run: (f: typeof fetch) => patchConsultation("a/b", { action: "complete" }, f),
      url: "/api/consultations/a%2Fb",
      method: "PATCH",
      body: { action: "complete" },
    },
    {
      name: "create",
      run: (f: typeof fetch) => createConsultationRequest(input, f),
      url: "/api/consultations",
      method: "POST",
      body: input,
    },
  ])("$name sends JSON to the right endpoint", async ({ run, url, method, body }) => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    await run(f as unknown as typeof fetch);
    const [u, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(u).toBe(url);
    expect(init.method).toBe(method);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(body);
  });
});
