import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";
import { config, proxy } from "@/proxy";

vi.mock("@/lib/supabase/proxy");

// Next compiles the matcher with path-to-regexp; for this pattern, anchoring it is equivalent.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
  it.each([
    ["/", true],
    ["/dashboard", true],
    ["/admin", true],
    ["/auth/login", true],
    ["/api/consultations", false],
    ["/api/admin/consultations", false],
    ["/_next/static/x.js", false],
    ["/_next/image", false],
    ["/logo.png", false],
    ["/favicon.ico", false],
  ])("%s -> %s", (path, expected) => {
    expect(matcher.test(path)).toBe(expected);
  });
});

const nonceOf = (csp: string | null) => /'nonce-([^']+)'/.exec(csp ?? "")?.[1];
const request = () => new NextRequest("http://app.test/dashboard");

describe("proxy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  });

  it.each([
    { name: "a passed-through request", respond: () => NextResponse.next() },
    {
      name: "a redirect from the session refresh",
      respond: () => NextResponse.redirect("http://app.test/auth/login"),
    },
  ])("$name carries a nonce CSP, and the request gets the same one", async ({ respond }) => {
    vi.mocked(updateSession).mockImplementation(async () => respond());
    const req = request();
    const res = await proxy(req);
    const csp = res.headers.get("Content-Security-Policy");
    const nonce = nonceOf(csp);
    expect(nonce).toBeTruthy();
    expect(req.headers.get("x-nonce")).toBe(nonce);
    expect(req.headers.get("Content-Security-Policy")).toBe(csp);
  });

  it.each([{ name: "each request gets a fresh nonce" }])("$name", async () => {
    vi.mocked(updateSession).mockImplementation(async () => NextResponse.next());
    const [a, b] = [await proxy(request()), await proxy(request())];
    const nonces = [a, b].map((r) => nonceOf(r.headers.get("Content-Security-Policy")));
    expect(nonces[0]).toBeTruthy();
    expect(nonces[0]).not.toBe(nonces[1]);
  });
});
