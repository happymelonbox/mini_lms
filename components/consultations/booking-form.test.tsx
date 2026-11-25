import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingForm } from "./booking-form";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// The real api client runs; only the network edge is faked, so error mapping is covered too.
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Values = { firstName: string; lastName: string; reason: string; scheduledAt: string };
const filled: Values = {
  firstName: "  Ann ",
  lastName: "Lee",
  reason: "Help with my essay",
  scheduledAt: "2999-01-01T10:00",
};

async function fillAndSubmit(values: Partial<Values>) {
  const user = userEvent.setup();
  render(<BookingForm />);
  const labels = {
    firstName: "First name",
    lastName: "Last name",
    reason: "What would you like to talk about?",
    scheduledAt: "Date and time",
  } as const;
  for (const [key, label] of Object.entries(labels) as [keyof Values, string][]) {
    const value = values[key];
    if (!value) continue;
    const input = screen.getByLabelText(label);
    // paste, not type: the long reason would take a keystroke each
    if (key === "reason") {
      await user.click(input);
      await user.paste(value);
    } else {
      await user.type(input, value);
    }
  }
  await user.click(screen.getByRole("button", { name: "Book it" }));
}

describe("BookingForm validation", () => {
  it.each([
    {
      name: "empty form asks for every field",
      values: {},
      messages: {
        "First name": "Add a first name",
        "Last name": "Add a last name",
        "What would you like to talk about?": "Tell us what you’d like to talk about",
        "Date and time": "Pick a date and time",
      },
    },
    {
      name: "blank first name",
      values: { ...filled, firstName: "   " },
      messages: { "First name": "Add a first name" },
    },
    {
      name: "reason over 1000 characters",
      values: { ...filled, reason: "x".repeat(1001) },
      messages: { "What would you like to talk about?": "Max 1000 characters" },
    },
    {
      name: "a time that has passed",
      values: { ...filled, scheduledAt: "2000-01-01T10:00" },
      messages: { "Date and time": "Pick a time that hasn’t passed yet" },
    },
  ])("$name", async ({ values, messages }) => {
    await fillAndSubmit(values);

    for (const [label, message] of Object.entries(messages)) {
      const field = screen.getByLabelText(label);
      expect(field).toBeInvalid();
      expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("BookingForm submit", () => {
  it.each([
    {
      name: "sends the trimmed values with a UTC time, then goes to the dashboard",
      values: filled,
      request: {
        firstName: "Ann",
        lastName: "Lee",
        reason: "Help with my essay",
        scheduledAt: new Date("2999-01-01T10:00").toISOString(),
      },
    },
  ])("$name", async ({ values, request }) => {
    fetchMock.mockResolvedValue(reply(201, { id: "c1" }));

    await fillAndSubmit(values);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/consultations");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(request);
    expect(router.push).toHaveBeenCalledWith("/dashboard");
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});

describe("BookingForm server errors", () => {
  it.each([
    {
      name: "429 rate limit shows the server message",
      response: () =>
        reply(429, {
          error: { code: "rate_limited", message: "Too many bookings, wait a minute." },
        }),
      alert: "Too many bookings, wait a minute.",
    },
    {
      name: "500 hides the server text behind a generic message",
      response: () => reply(500, { error: { code: "internal", message: "pg exploded" } }),
      alert: "Something went wrong. Please try again.",
    },
    {
      name: "network failure asks to check the connection",
      response: () => Promise.reject(new TypeError("offline")),
      alert: "Network error. Check your connection and try again.",
    },
  ])("$name", async ({ response, alert }) => {
    fetchMock.mockImplementation(async () => response());

    await fillAndSubmit(filled);

    expect(await screen.findByText(alert)).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "400 field errors land on the matching field",
      fields: { reason: ["Invalid characters"] },
      label: "What would you like to talk about?",
      message: "Invalid characters",
    },
    {
      name: "400 field error on the date",
      fields: { scheduledAt: ["Must be in the future"] },
      label: "Date and time",
      message: "Pick a time that hasn’t passed yet",
    },
  ])("$name", async ({ fields, label, message }) => {
    fetchMock.mockResolvedValue(
      reply(400, { error: { code: "validation_failed", message: "Invalid input", fields } }),
    );

    await fillAndSubmit(filled);

    const field = await screen.findByLabelText(label);
    await vi.waitFor(() => expect(field).toBeInvalid());
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(screen.queryByText("Invalid input")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
