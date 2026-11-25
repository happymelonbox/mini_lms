import { describe, expect, it } from "vitest";

// Pinned before the helpers run: Date reads TZ lazily, so the cases below do not depend on the CI machine.
process.env.TZ = "Australia/Sydney";
const { localInputToIso, isoToLocalInput, dateParts } = await import("./datetime");

describe("localInputToIso (Australia/Sydney)", () => {
  it.each([
    { name: "standard time (+10)", input: "2026-07-01T09:30", want: "2026-06-30T23:30:00.000Z" },
    { name: "daylight time (+11)", input: "2026-01-15T18:00", want: "2026-01-15T07:00:00.000Z" },
    { name: "keeps seconds", input: "2026-01-15T18:00:45", want: "2026-01-15T07:00:45.000Z" },
    { name: "before DST starts", input: "2026-10-04T01:59", want: "2026-10-03T15:59:00.000Z" },
    {
      name: "inside the spring-forward gap moves forward",
      input: "2026-10-04T02:30",
      want: "2026-10-03T16:30:00.000Z",
    },
    {
      name: "overlap hour resolves to the first occurrence",
      input: "2026-04-05T02:30",
      want: "2026-04-04T15:30:00.000Z",
    },
    { name: "after DST ends", input: "2026-04-05T03:30", want: "2026-04-04T17:30:00.000Z" },
    { name: "empty", input: "", want: null },
    { name: "garbage", input: "tomorrow", want: null },
    { name: "impossible date", input: "2026-13-45T10:00", want: null },
  ])("$name", ({ input, want }) => {
    expect(localInputToIso(input)).toBe(want);
  });

  it.each([
    { name: "summer", input: "2026-01-15T18:00" },
    { name: "winter", input: "2026-07-01T09:30" },
  ])("denotes the same instant as the local wall time ($name)", ({ input }) => {
    const iso = localInputToIso(input)!;
    expect(isoToLocalInput(iso)).toBe(input);
  });
});

describe("isoToLocalInput (Australia/Sydney)", () => {
  it.each([
    { name: "UTC in summer", iso: "2026-01-15T07:00:00Z", want: "2026-01-15T18:00" },
    { name: "UTC in winter", iso: "2026-07-01T23:30:00Z", want: "2026-07-02T09:30" },
    { name: "other offset", iso: "2026-07-01T09:30:00+02:00", want: "2026-07-01T17:30" },
    {
      name: "Postgres style timestamptz",
      iso: "2026-01-15T07:00:00.000+00:00",
      want: "2026-01-15T18:00",
    },
    { name: "invalid", iso: "nope", want: "" },
  ])("$name", ({ iso, want }) => {
    expect(isoToLocalInput(iso)).toBe(want);
  });
});

describe("UTC viewer", () => {
  it.each([{ input: "2026-03-01T10:00", want: "2026-03-01T10:00:00.000Z" }])(
    "localInputToIso($input) is UTC",
    async ({ input, want }) => {
      process.env.TZ = "UTC";
      expect(localInputToIso(input)).toBe(want);
      process.env.TZ = "Australia/Sydney";
    },
  );
});

describe("dateParts", () => {
  const now = new Date("2027-01-10T12:00:00Z");
  const ny = { locale: "en-US", timeZone: "America/New_York", now };
  it.each([
    {
      name: "viewer timezone",
      iso: "2027-03-15T18:30:00Z",
      opts: ny,
      want: { weekday: "Mon", day: "15", month: "Mar", year: null, time: "2:30 PM" },
    },
    {
      name: "late UTC is the previous day in New York",
      iso: "2027-03-16T02:00:00Z",
      opts: ny,
      want: { weekday: "Mon", day: "15", month: "Mar", year: null, time: "10:00 PM" },
    },
    {
      name: "other year shows the year",
      iso: "2026-12-31T15:00:00Z",
      opts: ny,
      want: { weekday: "Thu", day: "31", month: "Dec", year: "2026", time: "10:00 AM" },
    },
    {
      name: "year compared in the same timezone",
      iso: "2027-01-01T02:00:00Z",
      opts: ny,
      want: { weekday: "Thu", day: "31", month: "Dec", year: "2026", time: "9:00 PM" },
    },
    {
      name: "24-hour locale",
      iso: "2027-04-01T13:15:00Z",
      opts: { locale: "en-GB", timeZone: "Europe/London", now },
      want: { weekday: "Thu", day: "1", month: "Apr", year: null, time: "14:15" },
    },
    {
      name: "server render in UTC",
      iso: "2027-04-01T09:15:00+02:00",
      opts: { locale: "en-US", timeZone: "UTC", now },
      want: { weekday: "Thu", day: "1", month: "Apr", year: null, time: "7:15 AM" },
    },
    { name: "invalid", iso: "nope", opts: ny, want: null },
  ])("$name", ({ iso, opts, want }) => {
    const got = dateParts(iso, opts);
    // ICU puts a narrow no-break space before AM/PM; compare with a plain space.
    expect(got && { ...got, time: got.time.replace(/\u202f/g, " ") }).toEqual(want);
  });
});
