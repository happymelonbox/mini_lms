import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    { input: "/dashboard", expected: "/dashboard" },
    { input: "/admin?x=1#h", expected: "/admin?x=1#h" },
    { input: "/", expected: "/" },
    { input: null, expected: "/" },
    { input: "", expected: "/" },
    { input: "//evil.com", expected: "/" },
    { input: "/\\evil.com", expected: "/" },
    { input: "https://evil.com", expected: "/" },
    { input: "javascript:alert(1)", expected: "/" },
    { input: "dashboard", expected: "/" },
    { input: "/\t/evil.com", expected: "/" },
    { input: "/\n/evil.com", expected: "/" },
  ])("$input -> $expected", ({ input, expected }) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
