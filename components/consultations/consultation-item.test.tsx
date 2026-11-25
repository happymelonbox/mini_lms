import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultationDto } from "@/lib/consultations/service";
import { consultation } from "@/tests/fixtures";
import { router } from "@/tests/navigation";
import { ConsultationItem } from "./consultation-item";

// The real api client runs; only the network edge is faked.
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(Response.json({}));
});

const renderItem = (status: ConsultationDto["status"]) =>
  render(
    <ul>
      <ConsultationItem c={consultation({ status })} />
    </ul>,
  );

const patch = (body: object): [string, RequestInit] => [
  `/api/consultations/${consultation().id}`,
  { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
];
const mark = () => screen.getByRole("checkbox", { name: "Mark as done: Help with my essay" });
const setup = () => userEvent.setup({ delay: null });
const cancelAndConfirm = async (user: ReturnType<typeof setup>) => {
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Yes, cancel it" }));
};
const reschedule = async (user: ReturnType<typeof setup>, when: string) => {
  await user.click(screen.getByRole("button", { name: "Reschedule" }));
  const input = screen.getByLabelText("New date and time");
  await user.clear(input);
  await user.paste(when);
  await user.click(screen.getByRole("button", { name: "Save new time" }));
};

describe("ConsultationItem controls per status", () => {
  it.each<{
    status: ConsultationDto["status"];
    checked: boolean;
    actions: boolean;
    done: boolean;
  }>([
    { status: "scheduled", checked: false, actions: true, done: true },
    { status: "completed", checked: true, actions: false, done: true },
    { status: "cancelled", checked: false, actions: false, done: false },
  ])("$status", ({ status, checked, actions, done }) => {
    renderItem(status);

    expect(screen.getByRole("heading", { name: "Help with my essay" })).toBeVisible();
    expect(screen.getByText(status)).toBeVisible();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(done ? 1 : 0);
    if (done) expect(mark()).toHaveAttribute("aria-checked", String(checked));
    for (const name of ["Reschedule", "Cancel"]) {
      expect(screen.queryAllByRole("button", { name })).toHaveLength(actions ? 1 : 0);
    }
  });
});

describe("ConsultationItem actions", () => {
  it.each<{ name: string; status: ConsultationDto["status"]; body: object }>([
    { name: "ticking marks it complete", status: "scheduled", body: { action: "complete" } },
    { name: "unticking marks it incomplete", status: "completed", body: { action: "incomplete" } },
  ])("$name", async ({ status, body }) => {
    renderItem(status);

    await setup().click(mark());

    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(...patch(body));
  });

  it.each([
    {
      name: "reschedule sends the new time as UTC",
      when: "2999-07-01T09:30",
      body: { action: "reschedule", scheduledAt: new Date("2999-07-01T09:30").toISOString() },
    },
  ])("$name", async ({ when, body }) => {
    renderItem("scheduled");

    await reschedule(setup(), when);

    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(...patch(body));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "a time in the past is refused before any request",
      when: "2000-01-01T10:00",
      message: "Pick a time that hasn’t passed yet",
    },
  ])("$name", async ({ when, message }) => {
    renderItem("scheduled");

    await reschedule(setup(), when);

    expect(await screen.findByText(message)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: "asking to keep it sends nothing", confirm: false },
    { name: "confirming sends cancel", confirm: true },
  ])("cancel dialog: $name", async ({ confirm }) => {
    const user = setup();
    renderItem("scheduled");

    if (confirm) {
      await cancelAndConfirm(user);
      await vi.waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(...patch({ action: "cancel" }));
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
    fetchMock.mockResolvedValue(Response.json({ error: { code: "x", message } }, { status }));
    renderItem("scheduled");

    await setup().click(mark());

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(router.refresh).toHaveBeenCalledTimes(refreshes);
  });

  it.each([{ name: "a rejected reschedule keeps the dialog open with the message", status: 409 }])(
    "$name",
    async ({ status }) => {
      fetchMock.mockResolvedValue(
        Response.json({ error: { code: "x", message: "Too late to move" } }, { status }),
      );
      renderItem("scheduled");

      await reschedule(setup(), "2999-07-01T09:30");

      expect(await screen.findByText("Too late to move")).toBeVisible();
      expect(screen.getByRole("dialog")).toBeVisible();
    },
  );
});

describe("ConsultationItem focus after cancel", () => {
  it.each([{ name: "moves to the heading once the row shows cancelled" }])("$name", async () => {
    const user = setup();
    const { rerender } = renderItem("scheduled");

    await cancelAndConfirm(user);
    await vi.waitFor(() => expect(router.refresh).toHaveBeenCalled());
    rerender(
      <ul>
        <ConsultationItem c={consultation({ status: "cancelled" })} />
      </ul>,
    );

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Help with my essay" })).toHaveFocus(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled.");
  });
});
