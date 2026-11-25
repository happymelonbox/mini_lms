import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

const generic = "Something unexpected happened. Please try again.";

describe("Auth error page", () => {
  it.each([
    {
      name: "no_role",
      error: "no_role",
      text: "Your account isn’t set up yet. Ask an admin to give you access.",
    },
    {
      name: "missing_token",
      error: "missing_token",
      text: "That link is missing a piece. Ask for a new one and try again.",
    },
    {
      name: "invalid_link",
      error: "invalid_link",
      text: "That link has expired or was already used. Ask for a new one and try again.",
    },
    { name: "unknown code", error: "whatever", text: generic },
    { name: "no code", error: undefined, text: generic },
    // Prototype keys must not leak through the lookup.
    { name: "prototype key", error: "constructor", text: generic },
  ])("shows the right message for $name", async ({ error, text }) => {
    render(await Page({ searchParams: Promise.resolve({ error }) }));
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });
});
