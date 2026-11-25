import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import BookPage from "./page";

describe("BookPage", () => {
  it.each([
    { name: "shows the page heading", role: "heading", label: "Book a consultation" },
    { name: "shows the booking form submit button", role: "button", label: "Book it" },
  ])("$name", ({ role, label }) => {
    render(<BookPage />);
    expect(screen.getByRole(role, { name: label })).toBeInTheDocument();
  });
});
