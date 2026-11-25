import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each([
    { name: "scheduled", status: "scheduled" as const, label: "scheduled" },
    { name: "completed", status: "completed" as const, label: "completed" },
    { name: "cancelled", status: "cancelled" as const, label: "cancelled" },
  ])("$name shows its status as text", ({ status, label }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
