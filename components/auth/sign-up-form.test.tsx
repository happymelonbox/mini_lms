import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./sign-up-form";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const auth = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

beforeEach(() => vi.clearAllMocks());

async function submit(password: string, repeat: string) {
  const user = userEvent.setup();
  render(<SignUpForm />);
  await user.type(screen.getByLabelText("Email"), "ann@example.com");
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Type it again"), repeat);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignUpForm", () => {
  it.each([
    {
      name: "mismatched passwords never reach Supabase",
      repeat: "Different1",
      result: { error: null },
      alert: "The two passwords don’t match.",
      signUpCalls: 0,
    },
    {
      name: "matching passwords sign up and show the success page",
      repeat: "Password123!",
      result: { error: null },
      alert: null,
      signUpCalls: 1,
    },
    {
      name: "a Supabase error is shown",
      repeat: "Password123!",
      result: { error: new Error("User already registered") },
      alert: "User already registered",
      signUpCalls: 1,
    },
  ])("$name", async ({ repeat, result, alert, signUpCalls }) => {
    auth.signUp.mockResolvedValue(result);

    await submit("Password123!", repeat);

    expect(auth.signUp).toHaveBeenCalledTimes(signUpCalls);
    if (signUpCalls) {
      expect(auth.signUp).toHaveBeenCalledWith({ email: "ann@example.com", password: "Password123!" });
    }
    if (alert) {
      expect(await screen.findByRole("alert")).toHaveTextContent(alert);
      expect(router.push).not.toHaveBeenCalled();
    } else {
      await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/auth/sign-up-success"));
    }
  });
});
