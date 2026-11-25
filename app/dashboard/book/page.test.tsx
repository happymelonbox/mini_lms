import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BookPage from "./page";

describe("BookPage", () => {
  it.each([
    {
      name: "shows its heading and the booking form",
      heading: "Book a consultation",
      submit: "Book it",
    },
  ])("$name", ({ heading, submit }) => {
    render(<BookPage />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: submit })).toBeInTheDocument();
  });
});
