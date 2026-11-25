import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

it.each([
  { name: "unchecked to checked", startsChecked: false, disabled: false, calls: [true] },
  { name: "checked to unchecked", startsChecked: true, disabled: false, calls: [false] },
  { name: "disabled does not toggle", startsChecked: false, disabled: true, calls: [] },
])("Checkbox $name", async ({ startsChecked, disabled, calls }) => {
  const onCheckedChange = vi.fn();
  render(
    <Checkbox
      aria-label="Agree"
      defaultChecked={startsChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />,
  );
  const box = screen.getByRole("checkbox", { name: "Agree" });
  await userEvent.setup().click(box);
  expect(onCheckedChange.mock.calls.map(([value]) => value)).toEqual(calls);
  expect(box).toHaveAttribute("aria-checked", String(calls.length ? calls[0] : startsChecked));
});
