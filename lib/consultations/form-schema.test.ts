import { describe, expect, it } from "vitest";
import { isoToLocalInput } from "@/lib/datetime";
import { bookingFormSchema, friendlyMessage } from "./form-schema";

const future = new Date(Date.now() + 2 * 86400_000);
const localFuture = `${isoToLocalInput(future.toISOString()).slice(0, 10)}T10:00`;
const ok = { firstName: " Ann ", lastName: "Lee", reason: "Help", scheduledAt: localFuture };

describe("bookingFormSchema", () => {
  it.each([
    { name: "valid, trims names, emits UTC ISO", input: ok, error: undefined },
    { name: "empty first name", input: { ...ok, firstName: "  " }, error: "firstName" },
    { name: "reason too long", input: { ...ok, reason: "x".repeat(1001) }, error: "reason" },
    { name: "empty date", input: { ...ok, scheduledAt: "" }, error: "scheduledAt" },
    { name: "past date", input: { ...ok, scheduledAt: "2020-01-01T10:00" }, error: "scheduledAt" },
    { name: "garbage date", input: { ...ok, scheduledAt: "soon" }, error: "scheduledAt" },
  ])("$name", ({ input, error }) => {
    const r = bookingFormSchema.safeParse(input);
    if (!error) {
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.firstName).toBe("Ann");
        expect(r.data.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
      }
    } else {
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(error);
    }
  });
});

describe("friendlyMessage", () => {
  it.each([
    { field: "firstName", message: "Required", want: "Add a first name" },
    { field: "lastName", message: "Required", want: "Add a last name" },
    { field: "reason", message: "Required", want: "Tell us what you’d like to talk about" },
    {
      field: "scheduledAt",
      message: "Must be in the future",
      want: "Pick a time that hasn’t passed yet",
    },
    { field: "scheduledAt", message: "Pick a date and time", want: "Pick a date and time" },
    { field: "firstName", message: "Max 100 characters", want: "Max 100 characters" },
    { field: "scheduledAt", message: "Required", want: "Required" },
    { field: "reason", message: "constructor", want: "constructor" },
    { field: "reason", message: undefined, want: undefined },
  ] as const)("$field: $message", ({ field, message, want }) => {
    expect(friendlyMessage(field, message)).toBe(want);
  });
});
