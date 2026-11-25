import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "./proxy";

type SetAll = (c: { name: string; value: string; options: object }[]) => void;
type Options = { cookieOptions: { secure: boolean | undefined }; cookies: { setAll: SetAll } };

const m = vi.hoisted(() => {
  const getClaims = vi.fn();
  const createServerClient = vi.fn<(url: string, key: string, o: Options) => unknown>(() => ({
    auth: { getClaims },
  }));
  return { createServerClient, getClaims };
});
vi.mock("@supabase/ssr", () => ({ createServerClient: m.createServerClient }));

const SIGNED_IN = { data: { claims: { sub: "u1" } } };
const SIGNED_OUT = { data: null };
const req = (path: string) => new NextRequest(`http://app.test${path}`);
const optionsPassed = () => m.createServerClient.mock.calls[0][2] as Options;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("updateSession redirects", () => {
  it.each([
    { name: "signed out on /", path: "/", claims: SIGNED_OUT, redirectTo: "/auth/login" },
    {
      name: "signed out on /dashboard clears the query (_rsc)",
      path: "/dashboard?_rsc=abc&x=1",
      claims: SIGNED_OUT,
      redirectTo: "/auth/login",
    },
    {
      name: "signed out on /auth/login is left alone",
      path: "/auth/login",
      claims: SIGNED_OUT,
      redirectTo: null,
    },
    {
      name: "signed out on /auth/confirm is left alone",
      path: "/auth/confirm?token_hash=x",
      claims: SIGNED_OUT,
      redirectTo: null,
    },
    { name: "signed in on /dashboard", path: "/dashboard", claims: SIGNED_IN, redirectTo: null },
  ])("$name", async ({ path, claims, redirectTo }) => {
    m.getClaims.mockResolvedValue(claims);
    const res = await updateSession(req(path));
    if (redirectTo) {
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe(redirectTo);
      expect(location.search).toBe("");
    } else {
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

describe("updateSession cookies", () => {
  it.each([
    { name: "https origin gets Secure cookies", origin: "https://app.test", secure: true },
    { name: "http origin does not", origin: "http://localhost:3000", secure: false },
  ])("$name", async ({ origin, secure }) => {
    vi.stubEnv("APP_ORIGIN", origin);
    m.getClaims.mockResolvedValue(SIGNED_IN);
    await updateSession(req("/"));
    expect(optionsPassed().cookieOptions.secure).toBe(secure);
  });

  it.each([{ name: "refreshed cookies are on the returned response and the request" }])(
    "$name",
    async ({}) => {
      const request = req("/dashboard");
      m.getClaims.mockImplementation(async () => {
        optionsPassed().cookies.setAll([
          { name: "sb-token", value: "fresh", options: { path: "/" } },
        ]);
        return SIGNED_IN;
      });
      const res = await updateSession(request);
      expect(res.cookies.get("sb-token")?.value).toBe("fresh");
      expect(request.cookies.get("sb-token")?.value).toBe("fresh");
    },
  );
});
