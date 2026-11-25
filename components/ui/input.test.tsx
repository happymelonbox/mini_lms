import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Input } from "./input";

it.each([
  { name: "enabled", disabled: false, type: "email", typed: "a" },
  { name: "disabled blocks typing", disabled: true, type: "email", typed: "" },
])("Input $name", async ({ disabled, type, typed }) => {
  render(<Input aria-label="Email" type={type} disabled={disabled} />);
  const input = screen.getByRole("textbox", { name: "Email" });
  await userEvent.setup().type(input, "a");
  expect(input).toHaveValue(typed);
  expect(input).toHaveAttribute("type", type);
});
