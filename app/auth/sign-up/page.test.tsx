import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import Page from "./page";

describe("Sign up page", () => {
  it.each([
    { name: "shows its heading", role: "heading", label: "Create your account" },
    { name: "shows the email field", role: "textbox", label: "Email" },
    { name: "shows the submit button", role: "button", label: "Create account" },
  ])("$name", ({ role, label }) => {
    render(<Page />);
    expect(screen.getByRole(role, { name: label })).toBeInTheDocument();
  });
});
