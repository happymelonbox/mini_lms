import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Badge } from "./badge";

it.each([
  { name: "defaults to the scheduled look", props: {}, expectedClass: "bg-accent" },
  { name: "completed", props: { variant: "completed" as const }, expectedClass: "bg-success" },
  { name: "cancelled", props: { variant: "cancelled" as const }, expectedClass: "bg-muted" },
])("Badge $name", ({ props, expectedClass }) => {
  render(
    <Badge {...props} data-testid="badge" className="extra">
      Status
    </Badge>,
  );
  const badge = screen.getByTestId("badge");
  expect(badge).toHaveTextContent("Status");
  expect(badge).toHaveClass(expectedClass, "extra");
});
