import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Sign up success page", () => {
  it.each([{ name: "thanks the visitor and links home" }])("$name", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Thanks for signing up" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your consultations" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
