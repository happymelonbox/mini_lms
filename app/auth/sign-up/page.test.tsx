import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Sign up page", () => {
  it.each([
    {
      name: "shows its heading and the form",
      heading: "Create your account",
      submit: "Create account",
    },
  ])("$name", ({ heading, submit }) => {
    render(<Page />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: submit })).toBeInTheDocument();
  });
});
