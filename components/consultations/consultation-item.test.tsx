import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultationDto } from "@/lib/consultations/service";
import { ConsultationItem } from "./consultation-item";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// The real api client runs; only the network edge is faked.
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(200, {}));
});

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const consultation = (status: ConsultationDto["status"]): ConsultationDto => ({
  id: "c1",
  firstName: "Ann",
  lastName: "Lee",
  reason: "Help with my essay",
  scheduledAt: "2999-06-15T12:00:00.000Z",
  status,
  createdAt: "2999-01-01T00:00:00.000Z",
  updatedAt: "2999-01-01T00:00:00.000Z",
});

const renderItem = (status: ConsultationDto["status"]) =>
  render(
    <ul>
      <ConsultationItem c={consultation(status)} />
    </ul>,
  );

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
const mark = () => screen.getByRole("checkbox", { name: "Mark as done: Help with my essay" });
const cancelAndConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Yes, cancel it" }));
};

describe("ConsultationItem controls per status", () => {
  it.each([
    { name: "scheduled", status: "scheduled" as const, checked: false, actions: true, done: true },
    { name: "completed", status: "completed" as const, checked: true, actions: false, done: true },
    {
      name: "cancelled",
      status: "cancelled" as const,
      checked: false,
      actions: false,
      done: false,
    },
  ])("$name", ({ status, checked, actions, done }) => {
    renderItem(status);

    expect(screen.getByRole("heading", { name: "Help with my essay" })).toBeVisible();
    expect(screen.getByText(status)).toBeVisible();
    expect(screen.queryByRole("checkbox") !== null).toBe(done);
    if (done) expect(mark().getAttribute("aria-checked") === "true").toBe(checked);
    for (const name of ["Reschedule", "Cancel"]) {
      expect(screen.queryByRole("button", { name }) !== null).toBe(actions);
    }
  });
});

describe("ConsultationItem actions", () => {
  it.each([
    {
      name: "ticking marks it complete",
      status: "scheduled" as const,
      body: { action: "complete" },
    },
    {
      name: "unticking marks it incomplete",
      status: "completed" as const,
      body: { action: "incomplete" },
    },
  ])("$name", async ({ status, body }) => {
    renderItem(status);

    await userEvent.setup().click(mark());

    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/consultations/c1");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(sentBody()).toEqual(body);
  });

  it.each([
    {
      name: "reschedule sends the new time as UTC",
      when: "2999-07-01T09:30",
      body: { action: "reschedule", scheduledAt: new Date("2999-07-01T09:30").toISOString() },
    },
  ])("$name", async ({ when, body }) => {
    const user = userEvent.setup();
    renderItem("scheduled");

    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    const input = screen.getByLabelText("New date and time");
    await user.clear(input);
    await user.type(input, when);
    await user.click(screen.getByRole("button", { name: "Save new time" }));

    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(sentBody()).toEqual(body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "a time in the past is refused before any request",
      when: "2000-01-01T10:00",
      message: "Pick a time that hasn’t passed yet",
    },
  ])("$name", async ({ when, message }) => {
    const user = userEvent.setup();
    renderItem("scheduled");

    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    const input = screen.getByLabelText("New date and time");
    await user.clear(input);
    await user.type(input, when);
    await user.click(screen.getByRole("button", { name: "Save new time" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: "asking to keep it sends nothing", confirm: false },
    { name: "confirming sends cancel", confirm: true },
  ])("cancel dialog: $name", async ({ confirm }) => {
    const user = userEvent.setup();
    renderItem("scheduled");

    if (confirm) {
      await cancelAndConfirm(user);
      await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
      expect(sentBody()).toEqual({ action: "cancel" });
    } else {
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Keep it" }));
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });
});

describe("ConsultationItem server errors", () => {
  it.each([
    {
      name: "409 shows the message and refreshes the stale row",
      status: 409,
      message: "Already cancelled",
      refreshes: 1,
    },
    {
      name: "429 shows the message and does not refresh",
      status: 429,
      message: "Too many changes, wait a minute.",
      refreshes: 0,
    },
  ])("$name", async ({ status, message, refreshes }) => {
    fetchMock.mockResolvedValue(reply(status, { error: { code: "x", message } }));
    renderItem("scheduled");

    await userEvent.setup().click(mark());

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(router.refresh).toHaveBeenCalledTimes(refreshes);
  });

  it.each([{ name: "a rejected reschedule keeps the dialog open with the message", status: 409 }])(
    "$name",
    async ({ status }) => {
      fetchMock.mockResolvedValue(
        reply(status, { error: { code: "x", message: "Too late to move" } }),
      );
      const user = userEvent.setup();
      renderItem("scheduled");

      await user.click(screen.getByRole("button", { name: "Reschedule" }));
      const input = screen.getByLabelText("New date and time");
      await user.clear(input);
      await user.type(input, "2999-07-01T09:30");
      await user.click(screen.getByRole("button", { name: "Save new time" }));

      expect(await screen.findByText("Too late to move")).toBeVisible();
      expect(screen.getByRole("dialog")).toBeVisible();
    },
  );
});

describe("ConsultationItem focus after cancel", () => {
  it.each([{ name: "moves to the heading once the row shows cancelled" }])("$name", async () => {
    const user = userEvent.setup();
    const { rerender } = renderItem("scheduled");

    await cancelAndConfirm(user);
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalled());
    rerender(
      <ul>
        <ConsultationItem c={consultation("cancelled")} />
      </ul>,
    );

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Help with my essay" })).toHaveFocus(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled.");
  });
});
