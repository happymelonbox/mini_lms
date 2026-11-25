import { expect, it } from "vitest";
import { cn } from "./utils";

it.each([
  { name: "later tailwind class wins a conflict", input: ["p-2", "p-4"], expected: "p-4" },
  { name: "drops falsy values", input: ["a", false, null, undefined, "", "b"], expected: "a b" },
])("cn $name", ({ input, expected }) => {
  expect(cn(...input)).toBe(expected);
});
