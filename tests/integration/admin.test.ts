import { beforeAll, describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/consultations/schema";
import { GET as adminGET } from "@/app/api/admin/consultations/route";
import { call, create, NIL_UUID, setupClients } from "./helpers";

beforeAll(setupClients);

describe("GET /api/admin/consultations", () => {
  it.each([{ name: "admin sees both students" }])("$name", async () => {
    // Earlier runs leave rows behind and the list is soonest first: start the page just before these two.
    const at = new Date(Date.now() + 40 * 86_400_000);
    const ids = [
      await create("student", { scheduledAt: at.toISOString() }),
      await create("student2", { scheduledAt: at.toISOString() }),
    ];
    const from = encodeCursor(new Date(at.getTime() - 1000).toISOString(), NIL_UUID);
    const { res, body } = await call(
      "admin",
      adminGET,
      `/api/admin/consultations?pageSize=50&after=${from}`,
    );
    expect(res.status).toBe(200);
    expect(body.pageSize).toBe(50);
    expect(body.total).toBeUndefined();
    expect(body.data.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining(ids));
  });

  it.each([{ name: "student refused", actor: "student" as const }])("$name", async ({ actor }) => {
    const { res, body } = await call(actor, adminGET, "/api/admin/consultations");
    expect(res.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });
});
