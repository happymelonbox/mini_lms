import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest globals are off, so RTL cannot register its own auto-cleanup.
afterEach(cleanup);

// One fake per boundary for every component test; tests import the spies from tests/navigation.ts.
// A test file's own vi.mock of the same module still wins.
vi.mock("next/navigation", async () => (await import("./navigation")).navigation);
vi.mock("@/lib/supabase/client", async () => {
  const { auth } = await import("./navigation");
  return { createClient: () => ({ auth }) };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
