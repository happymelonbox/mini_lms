import { AuthError, type VerifyOtpParams } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const m = vi.hoisted(() => ({
  verifyOtp: vi.fn<(p: VerifyOtpParams) => Promise<{ error: AuthError | null }>>(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp: m.verifyOtp } }),
}));
// Next's redirect() throws; surface the target so the test can read where the user lands.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  m.verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/confirm", () => {
  it.each([
    {
      name: "valid token goes to next",
      qs: "token_hash=abc&type=email&next=/dashboard",
      to: "/dashboard",
      verified: true,
    },
    {
      name: "valid token without next goes home",
      qs: "token_hash=abc&type=email",
      to: "/",
      verified: true,
    },
    {
      name: "absolute next URL stays on-site",
      qs: "token_hash=abc&type=email&next=https://evil.test/x",
      to: "/",
      verified: true,
    },
    {
      name: "protocol-relative next stays on-site",
      qs: "token_hash=abc&type=email&next=//evil.test",
      to: "/",
      verified: true,
    },
    {
      name: "verification failure goes to the error page",
      qs: "token_hash=abc&type=email&next=/dashboard",
      verify: { error: new AuthError("expired secret text") },
      to: "/auth/error?error=invalid_link",
      verified: true,
    },
    {
      name: "missing token_hash never calls Supabase",
      qs: "type=email",
      to: "/auth/error?error=missing_token",
      verified: false,
    },
    {
      name: "missing type never calls Supabase",
      qs: "token_hash=abc",
      to: "/auth/error?error=missing_token",
      verified: false,
    },
  ])("$name", async ({ qs, verify, to, verified }) => {
    if (verify) m.verifyOtp.mockResolvedValue(verify);
    await expect(GET(new NextRequest(`http://app.test/auth/confirm?${qs}`))).rejects.toEqual(
      new Error(`REDIRECT:${to}`),
    );
    if (verified) {
      expect(m.verifyOtp).toHaveBeenCalledExactlyOnceWith({ type: "email", token_hash: "abc" });
    } else {
      expect(m.verifyOtp).not.toHaveBeenCalled();
    }
  });
});
