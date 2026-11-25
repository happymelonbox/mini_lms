import { describe, expect, it } from "vitest";
import { getCurrentUser } from "./current-user";

const clientWith = (claims: Record<string, unknown> | null) =>
  ({ auth: { getClaims: async () => ({ data: claims && { claims }, error: null }) } }) as never;

describe("getCurrentUser", () => {
  it.each([
    {
      name: "student",
      claims: { sub: "u1", user_role: "student", email: "a@b.test" },
      expected: { id: "u1", role: "student", email: "a@b.test" },
    },
    {
      name: "admin",
      claims: { sub: "u1", user_role: "admin", email: "a@b.test" },
      expected: { id: "u1", role: "admin", email: "a@b.test" },
    },
    {
      name: "missing role",
      claims: { sub: "u1" },
      expected: { id: "u1", role: null, email: undefined },
    },
    {
      name: "unknown role",
      claims: { sub: "u1", user_role: "root" },
      expected: { id: "u1", role: null, email: undefined },
    },
    { name: "no claims", claims: null, expected: null },
    { name: "no sub", claims: { user_role: "admin" }, expected: null },
  ])("$name", async ({ claims, expected }) => {
    expect(await getCurrentUser(clientWith(claims))).toEqual(expected);
  });
});
