import { beforeAll, describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/consultations/schema";
import { GET as adminGET } from "@/app/api/admin/consultations/route";
import { call, create, setupClients } from "./helpers";

beforeAll(setupClients);

const NIL_ID = "00000000-0000-4000-8000-000000000000";

describe("GET /api/admin/consultations", () => {
  it.each([
    { name: "admin sees both students", actor: "admin" as const, status: 200 },
    { name: "student refused", actor: "student" as const, status: 403 },
    { name: "student2 refused", actor: "student2" as const, status: 403 },
  ])("$name", async ({ actor, status }) => {
    // Earlier runs leave rows behind and the list is soonest first: start the page just before these two.
    const at = new Date(Date.now() + 40 * 86_400_000);
    const ids = [
      await create("student", { scheduledAt: at.toISOString() }),
      await create("student2", { scheduledAt: at.toISOString() }),
    ];
    const from = encodeCursor(new Date(at.getTime() - 1000).toISOString(), NIL_ID);
    const { res, body } = await call(
      actor,
      adminGET,
      `/api/admin/consultations?pageSize=50&after=${from}`,
    );
    expect(res.status).toBe(status);
    if (status === 200) {
      expect(body.pageSize).toBe(50);
      expect(body.total).toBeUndefined();
      expect(body.data.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining(ids));
    } else {
      expect(body.error.code).toBe("forbidden");
    }
  });

  const cursor = encodeCursor("2026-11-26T23:04:51+00:00", "3f2c1a9e-5b7d-4c8e-9a10-0123456789ab");
  it.each([
    { name: "pageSize 51", q: "?pageSize=51", status: 400 },
    { name: "after and before both", q: `?after=${cursor}&before=x`, status: 400 },
  ])("pagination $name", async ({ q, status }) => {
    expect((await call("admin", adminGET, `/api/admin/consultations${q}`)).res.status).toBe(status);
  });
});
