import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Sign up success page", () => {
  it.each([
    { name: "thanks the visitor", role: "heading", label: "Thanks for signing up", href: null },
    { name: "links home", role: "link", label: "Go to your consultations", href: "/" },
  ])("$name", ({ role, label, href }) => {
    render(<Page />);
    const el = screen.getByRole(role, { name: label });
    expect(el).toBeInTheDocument();
    if (href) expect(el).toHaveAttribute("href", href);
  });
});
