import { expect, it } from "vitest";
import { cn } from "./utils";

it.each([
  { name: "later tailwind class wins a conflict", input: ["p-2", "p-4"], expected: "p-4" },
  { name: "keeps non-conflicting classes", input: ["p-2", "text-sm"], expected: "p-2 text-sm" },
  { name: "drops falsy values", input: ["a", false, null, undefined, "", "b"], expected: "a b" },
  {
    name: "applies object and array syntax",
    input: [{ a: true, b: false }, ["c"]],
    expected: "a c",
  },
  { name: "no input gives empty string", input: [], expected: "" },
])("cn $name", ({ input, expected }) => {
  expect(cn(...input)).toBe(expected);
});
