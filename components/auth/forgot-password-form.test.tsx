import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";

const auth = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

beforeEach(() => vi.clearAllMocks());

describe("ForgotPasswordForm", () => {
  it.each([
    {
      name: "success asks the user to check their inbox",
      result: { error: null },
      visible: "Check your inbox",
      hidden: null,
    },
    {
      name: "failure shows the error and keeps the form",
      result: { error: new Error("Email rate limit exceeded") },
      visible: "Email rate limit exceeded",
      hidden: "Check your inbox",
    },
  ])("$name", async ({ result, visible, hidden }) => {
    auth.resetPasswordForEmail.mockResolvedValue(result);
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "ann@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(visible)).toBeVisible();
    if (hidden) expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ann@example.com");
  });
});
