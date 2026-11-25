import { existsSync } from "node:fs";
import { vi } from "vitest";

// Same .env.local the app uses. @next/env's loadEnvConfig skips .env.local when NODE_ENV=test,
// so use Node's built-in loader instead.
// CI has no file and sets the variables in the environment instead.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Handlers call createClient() from lib/supabase/server (cookie based). The import is lazy so the
// mock factory and helpers.ts share one module instance.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (await import("./helpers")).current.client,
}));
