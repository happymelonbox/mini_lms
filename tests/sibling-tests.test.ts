import { existsSync, globSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every code file has a sibling unit test. Generated types are the only exception.
const GENERATED = ["lib/database.types.ts"];

const sources = globSync("{app,components,hooks,lib}/**/*.{ts,tsx}")
  .concat("proxy.ts")
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => !/\.test\.tsx?$|\.d\.ts$/.test(file) && !GENERATED.includes(file))
  .sort();

describe("sibling unit tests", () => {
  it.each([{ name: "finds the source tree", count: sources.length }])("$name", ({ count }) => {
    expect(count).toBeGreaterThan(40);
  });

  it.each(sources.map((file) => ({ file })))("$file has a sibling test", ({ file }) => {
    const base = file.replace(/\.tsx?$/, "");
    expect(existsSync(`${base}.test.ts`) || existsSync(`${base}.test.tsx`)).toBe(true);
  });
});
