import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdatePasswordForm } from "./update-password-form";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const auth = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

beforeEach(() => vi.clearAllMocks());

describe("UpdatePasswordForm", () => {
  it.each([
    { name: "success saves the password and goes home", result: { error: null }, alert: null },
    {
      name: "a weak password error is shown",
      result: { error: new Error("Password should contain a number") },
      alert: "Password should contain a number",
    },
  ])("$name", async ({ result, alert }) => {
    auth.updateUser.mockResolvedValue(result);
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Save new password" }));

    await vi.waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: "Password123!" }));
    if (alert) {
      expect(await screen.findByRole("alert")).toHaveTextContent(alert);
      expect(router.push).not.toHaveBeenCalled();
    } else {
      await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    }
  });
});
