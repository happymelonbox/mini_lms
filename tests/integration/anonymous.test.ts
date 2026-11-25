import { beforeAll, describe, expect, it } from "vitest";
import { GET as adminGET } from "@/app/api/admin/consultations/route";
import { PATCH } from "@/app/api/consultations/[id]/route";
import { GET, POST } from "@/app/api/consultations/route";
import { call, JSON_HEADERS, setupClients, valid } from "./helpers";

beforeAll(setupClients);

describe("401 for anonymous callers", () => {
  it.each([
    { name: "GET list", fn: GET, url: "/api/consultations", init: {} },
    {
      name: "POST create",
      fn: POST,
      url: "/api/consultations",
      init: { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(valid()) },
    },
    {
      name: "PATCH",
      fn: PATCH,
      url: "/api/consultations/11111111-1111-4111-8111-111111111111",
      init: { method: "PATCH", headers: JSON_HEADERS, body: '{"action":"cancel"}' },
    },
    { name: "admin GET", fn: adminGET, url: "/api/admin/consultations", init: {} },
  ])("$name", async ({ fn, url, init }) => {
    const { res, body } = await call("anon", fn, url, init);
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.error.code).toBe("unauthorized");
  });
});
