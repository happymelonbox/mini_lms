import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./button";

it.each([
  { name: "fires onClick", disabled: false, clicks: 1 },
  { name: "disabled never fires onClick", disabled: true, clicks: 0 },
])("Button $name", async ({ disabled, clicks }) => {
  const onClick = vi.fn<() => void>();
  render(
    <Button disabled={disabled} onClick={onClick}>
      Go
    </Button>,
  );
  await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Go" }));
  expect(onClick).toHaveBeenCalledTimes(clicks);
});

it.each([
  { name: "default variant", variant: undefined, expectedClass: "bg-primary" },
  { name: "destructive variant", variant: "destructive" as const, expectedClass: "bg-destructive" },
])("Button $name has its class", ({ variant, expectedClass }) => {
  render(<Button variant={variant}>Go</Button>);
  expect(screen.getByRole("button", { name: "Go" })).toHaveClass(expectedClass);
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
