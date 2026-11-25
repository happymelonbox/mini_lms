import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import Page from "./page";

describe("Login page", () => {
  it.each([
    { name: "shows its heading", role: "heading", label: "Log in" },
    { name: "shows the email field", role: "textbox", label: "Email" },
    { name: "shows the submit button", role: "button", label: "Log in" },
  ])("$name", ({ role, label }) => {
    render(<Page />);
    expect(screen.getByRole(role, { name: label })).toBeInTheDocument();
  });
});
