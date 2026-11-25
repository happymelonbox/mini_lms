import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Textarea } from "./textarea";

it.each([
  { name: "enabled", disabled: false, expected: "hi" },
  { name: "disabled blocks typing", disabled: true, expected: "" },
])("Textarea $name", async ({ disabled, expected }) => {
  render(<Textarea aria-label="Reason" disabled={disabled} />);
  const field = screen.getByRole("textbox", { name: "Reason" });
  await userEvent.setup().type(field, "hi");
  expect(field).toHaveValue(expected);
});
