import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import Page from "./page";

describe("Update password page", () => {
  it.each([
    { name: "shows its heading", role: "heading", label: "Choose a new password" },
    { name: "shows the submit button", role: "button", label: "Save new password" },
  ])("$name", ({ role, label }) => {
    render(<Page />);
    expect(screen.getByRole(role, { name: label })).toBeInTheDocument();
  });

  it.each([{ name: "labels the new password field", label: "New password" }])(
    "$name",
    ({ label }) => {
      render(<Page />);
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    },
  );
});
