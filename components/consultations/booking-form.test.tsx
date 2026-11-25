import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "@/tests/navigation";
import { BookingForm } from "./booking-form";

// The real api client runs; only the network edge is faked. Its 500 and network mapping is client.test.ts's.
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

type Values = { firstName: string; lastName: string; reason: string; scheduledAt: string };
const filled: Values = {
  firstName: "  Ann ",
  lastName: "Lee",
  reason: "Help with my essay",
  scheduledAt: "2999-01-01T10:00",
};

async function fillAndSubmit(values: Partial<Values>) {
  const user = userEvent.setup({ delay: null });
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
    await user.click(screen.getByLabelText(label));
    await user.paste(value);
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
    fetchMock.mockResolvedValue(Response.json({ id: "c1" }, { status: 201 }));

    await fillAndSubmit(values);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/consultations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});

describe("BookingForm server errors", () => {
  it.each([
    {
      name: "429 rate limit shows the server message",
      reply: async () =>
        Response.json(
          { error: { code: "rate_limited", message: "Too many bookings, wait a minute." } },
          { status: 429 },
        ),
      alert: "Too many bookings, wait a minute.",
    },
    {
      name: "network failure asks the user to retry",
      reply: async (): Promise<Response> => {
        throw new TypeError("Failed to fetch");
      },
      alert: "Network error. Check your connection and try again.",
    },
  ])("$name", async ({ reply, alert }) => {
    fetchMock.mockImplementation(reply);

    await fillAndSubmit(filled);

    expect(await screen.findByText(alert)).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "400 field error on the date",
      fields: { scheduledAt: ["Must be in the future"] },
      label: "Date and time",
      message: "Pick a time that hasn’t passed yet",
    },
    {
      name: "400 field error on the reason",
      fields: { reason: ["Required"] },
      label: "What would you like to talk about?",
      message: "Tell us what you’d like to talk about",
    },
    {
      name: "400 field error on the first name",
      fields: { firstName: ["Max 100 characters"] },
      label: "First name",
      message: "Max 100 characters",
    },
  ])("$name", async ({ fields, label, message }) => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: "validation_failed", message: "Invalid input", fields } },
        { status: 400 },
      ),
    );

    await fillAndSubmit(filled);

    const field = await screen.findByLabelText(label);
    await vi.waitFor(() => expect(field).toBeInvalid());
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(screen.queryByText("Invalid input")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
