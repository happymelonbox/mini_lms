import { describe, expect, it } from "vitest";
import { encodeCursor } from "./schema";
import { parseCursors } from "./list-page";

const ID = "3f2c1a9e-5b7d-4c8e-9a10-0123456789ab";
const TS = "2026-11-26T23:04:51.09091+00:00";
const c = encodeCursor(TS, ID);
const cur = { scheduledAt: TS, id: ID };

describe("parseCursors", () => {
  it.each([
    { name: "none", raw: {}, want: {} },
    { name: "after", raw: { after: c }, want: { after: cur } },
    { name: "before", raw: { before: c }, want: { before: cur } },
    { name: "garbage after falls back to the default view", raw: { after: "!!" }, want: {} },
    { name: "both set falls back", raw: { after: c, before: c }, want: {} },
    { name: "repeated param falls back", raw: { after: [c, c] }, want: {} },
  ])("$name", ({ raw, want }) => {
    expect(parseCursors(raw)).toEqual(want);
  });
});
