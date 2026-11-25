import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./server";

type Options = {
  cookieOptions: { secure: boolean | undefined };
  cookies: {
    getAll: () => unknown;
    setAll: (c: { name: string; value: string; options: object }[]) => void;
  };
};

const m = vi.hoisted(() => ({
  createServerClient: vi.fn<(url: string, key: string, o: Options) => unknown>(
    () => "server-client",
  ),
  store: { getAll: vi.fn(), set: vi.fn() },
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: m.createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => m.store }));

const optionsPassed = () => m.createServerClient.mock.calls[0][2] as Options;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  m.store.set.mockReset();
});

describe("server createClient", () => {
  it.each([
    { name: "https origin gets Secure cookies", origin: "https://app.test", secure: true },
    { name: "http origin does not", origin: "http://localhost:3000", secure: false },
  ])("$name", async ({ origin, secure }) => {
    vi.stubEnv("APP_ORIGIN", origin);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub-key");
    expect(await createClient()).toBe("server-client");
    expect(m.createServerClient.mock.calls[0].slice(0, 2)).toEqual(["http://sb.test", "pub-key"]);
    expect(optionsPassed().cookieOptions.secure).toBe(secure);
  });

  it.each([
    {
      name: "setAll writes cookies to the request store",
      throws: false,
    },
    {
      name: "setAll swallows the error when called from a Server Component",
      throws: true,
    },
  ])("$name", async ({ throws }) => {
    if (throws) {
      m.store.set.mockImplementation(() => {
        throw new Error("read-only");
      });
    }
    await createClient();
    const { cookies } = optionsPassed();
    expect(() =>
      cookies.setAll([{ name: "sb", value: "v", options: { path: "/" } }]),
    ).not.toThrow();
    expect(m.store.set).toHaveBeenCalledWith("sb", "v", { path: "/" });
  });

  it.each([{ name: "getAll reads from the request cookie store" }])("$name", async () => {
    m.store.getAll.mockReturnValue([{ name: "a", value: "1" }]);
    await createClient();
    expect(optionsPassed().cookies.getAll()).toEqual([{ name: "a", value: "1" }]);
  });
});
