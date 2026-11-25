import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

it.each<{ name: string; startsChecked: boolean; disabled: boolean; call: boolean | null }>([
  { name: "unchecked to checked", startsChecked: false, disabled: false, call: true },
  { name: "checked to unchecked", startsChecked: true, disabled: false, call: false },
  { name: "disabled does not toggle", startsChecked: false, disabled: true, call: null },
])("Checkbox $name", async ({ startsChecked, disabled, call }) => {
  const onCheckedChange = vi.fn<(checked: boolean | "indeterminate") => void>();
  render(
    <Checkbox
      aria-label="Agree"
      defaultChecked={startsChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />,
  );
  const box = screen.getByRole("checkbox", { name: "Agree" });
  await userEvent.setup({ delay: null }).click(box);
  if (call === null) expect(onCheckedChange).not.toHaveBeenCalled();
  else expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(call);
  expect(box).toHaveAttribute("aria-checked", String(call ?? startsChecked));
});
