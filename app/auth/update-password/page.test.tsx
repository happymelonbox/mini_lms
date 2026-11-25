import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Update password page", () => {
  it.each([{ name: "shows its heading, the password field and the submit button" }])(
    "$name",
    () => {
      render(<Page />);
      expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
      expect(screen.getByLabelText("New password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save new password" })).toBeInTheDocument();
    },
  );
});
