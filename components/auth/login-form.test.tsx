import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

beforeEach(() => vi.clearAllMocks());

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  it.each([
    { name: "success sends the credentials and goes home", result: { error: null }, alert: null },
    {
      name: "wrong credentials get a friendly message",
      result: { error: new Error("Invalid login credentials") },
      alert: "That email and password don’t match. Try again.",
    },
    {
      name: "any other Supabase message passes through",
      result: { error: new Error("Email not confirmed") },
      alert: "Email not confirmed",
    },
  ])("$name", async ({ result, alert }) => {
    auth.signInWithPassword.mockResolvedValue(result);

    await submit("ann@example.com", "Password123!");

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ann@example.com",
      password: "Password123!",
    });
    if (alert) {
      expect(await screen.findByRole("alert")).toHaveTextContent(alert);
      expect(router.push).not.toHaveBeenCalled();
    } else {
      await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  });

  it.each([
    { name: "forgot password link", label: "Forgot password?", href: "/auth/forgot-password" },
    { name: "sign up link", label: "Create an account", href: "/auth/sign-up" },
  ])("$name", ({ label, href }) => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });
});
