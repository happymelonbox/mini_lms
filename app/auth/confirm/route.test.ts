import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";

const m = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp: m.verifyOtp } }),
}));
// Next's redirect() throws; surface the target so the test can read where the user lands.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const landing = async (qs: string) => {
  try {
    await GET(new Request(`http://app.test/auth/confirm?${qs}`) as NextRequest);
  } catch (e) {
    return (e as Error).message.replace("REDIRECT:", "");
  }
  return "no redirect";
};

beforeEach(() => {
  vi.resetAllMocks();
  m.verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/confirm", () => {
  it.each([
    {
      name: "valid token goes to next",
      qs: "token_hash=abc&type=email&next=/dashboard",
      verify: { error: null },
      to: "/dashboard",
      verified: true,
    },
    {
      name: "valid token without next goes home",
      qs: "token_hash=abc&type=email",
      verify: { error: null },
      to: "/",
      verified: true,
    },
    {
      name: "absolute next URL stays on-site",
      qs: "token_hash=abc&type=email&next=https://evil.test/x",
      verify: { error: null },
      to: "/",
      verified: true,
    },
    {
      name: "protocol-relative next stays on-site",
      qs: "token_hash=abc&type=email&next=//evil.test",
      verify: { error: null },
      to: "/",
      verified: true,
    },
    {
      name: "verification failure goes to the error page",
      qs: "token_hash=abc&type=email&next=/dashboard",
      verify: { error: { message: "expired secret text" } },
      to: "/auth/error?error=invalid_link",
      verified: true,
    },
    {
      name: "missing token_hash never calls Supabase",
      qs: "type=email",
      verify: { error: null },
      to: "/auth/error?error=missing_token",
      verified: false,
    },
    {
      name: "missing type never calls Supabase",
      qs: "token_hash=abc",
      verify: { error: null },
      to: "/auth/error?error=missing_token",
      verified: false,
    },
  ])("$name", async ({ qs, verify, to, verified }) => {
    m.verifyOtp.mockResolvedValue(verify);
    expect(await landing(qs)).toBe(to);
    if (verified) expect(m.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    else expect(m.verifyOtp).not.toHaveBeenCalled();
  });
});
