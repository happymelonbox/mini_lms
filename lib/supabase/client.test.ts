import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./client";

const m = vi.hoisted(() => ({ createBrowserClient: vi.fn(() => "browser-client") }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: m.createBrowserClient }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  m.createBrowserClient.mockClear();
});

describe("browser createClient", () => {
  it.each([
    { name: "https page gets Secure cookies", protocol: "https:", secure: true },
    { name: "http page (localhost) does not", protocol: "http:", secure: false },
  ])("$name", ({ protocol, secure }) => {
    vi.stubGlobal("window", { location: { protocol } });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://sb.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub-key");
    expect(createClient()).toBe("browser-client");
    expect(m.createBrowserClient).toHaveBeenCalledWith("http://sb.test", "pub-key", {
      cookieOptions: { secure },
    });
  });
});
