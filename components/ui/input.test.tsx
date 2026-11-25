import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Input } from "./input";

it.each([
  { name: "enabled", disabled: false, expected: "a" },
  { name: "disabled blocks typing", disabled: true, expected: "" },
])("Input $name", async ({ disabled, expected }) => {
  render(<Input aria-label="Email" type="email" disabled={disabled} />);
  const input = screen.getByRole("textbox", { name: "Email" });
  await userEvent.setup({ delay: null }).type(input, "a");
  expect(input).toHaveValue(expected);
  expect(input).toHaveAttribute("type", "email");
});
