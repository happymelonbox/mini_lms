import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./button";

it.each([
  { name: "default fires onClick", variant: undefined, disabled: false, clicks: 1 },
  {
    name: "destructive fires onClick",
    variant: "destructive" as const,
    disabled: false,
    clicks: 1,
  },
  { name: "disabled never fires onClick", variant: undefined, disabled: true, clicks: 0 },
])("Button $name", async ({ variant, disabled, clicks }) => {
  const onClick = vi.fn();
  render(
    <Button variant={variant} disabled={disabled} onClick={onClick}>
      Go
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Go" });
  if (variant) expect(button).toHaveClass("bg-destructive");
  await userEvent.setup().click(button);
  expect(onClick).toHaveBeenCalledTimes(clicks);
});

it.each([{ name: "asChild renders the child element, not a button" }])("Button $name", () => {
  render(
    <Button asChild>
      <a href="/x">Next</a>
    </Button>,
  );
  expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/x");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
