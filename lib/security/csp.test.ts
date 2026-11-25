import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

const SUPA = "http://127.0.0.1:54321";
const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(name + " "));

describe("buildCsp", () => {
  it.each([
    {
      name: "script-src has nonce + strict-dynamic, no eval in prod",
      isDev: false,
      dir: "script-src",
      has: ["'self'", "'nonce-abc'", "'strict-dynamic'"],
      lacks: ["'unsafe-eval'"],
    },
    {
      name: "script-src allows eval only in dev",
      isDev: true,
      dir: "script-src",
      has: ["'nonce-abc'", "'unsafe-eval'"],
      lacks: [],
    },
    {
      name: "connect-src includes supabase",
      isDev: false,
      dir: "connect-src",
      has: ["'self'", SUPA],
      lacks: ["ws:"],
    },
    {
      name: "connect-src ws in dev",
      isDev: true,
      dir: "connect-src",
      has: [SUPA, "ws:"],
      lacks: [],
    },
    {
      name: "frame-ancestors none",
      isDev: false,
      dir: "frame-ancestors",
      has: ["'none'"],
      lacks: [],
    },
    { name: "object-src none", isDev: false, dir: "object-src", has: ["'none'"], lacks: [] },
    { name: "default-src self", isDev: false, dir: "default-src", has: ["'self'"], lacks: [] },
    { name: "form-action self", isDev: false, dir: "form-action", has: ["'self'"], lacks: [] },
    { name: "base-uri self", isDev: false, dir: "base-uri", has: ["'self'"], lacks: [] },
  ])("$name", ({ isDev, dir, has, lacks }) => {
    const d = directive(buildCsp({ nonce: "abc", supabaseUrl: SUPA, isDev }), dir)!;
    expect(d).toBeDefined();
    for (const h of has) expect(d.split(" ")).toContain(h);
    for (const l of lacks) expect(d.split(" ")).not.toContain(l);
  });
});
