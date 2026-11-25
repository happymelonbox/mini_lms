import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocalDateTime } from "./local-date-time";

describe("LocalDateTime", () => {
  it.each([
    // Midday UTC keeps the month the same in every timezone.
    { name: "a valid ISO renders a <time> with that instant", iso: "2999-06-15T12:00:00Z" },
  ])("$name", ({ iso }) => {
    const { container } = render(<LocalDateTime iso={iso} />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", iso);
    expect(time).toHaveTextContent(/Jun.*2999/);
  });

  it.each([{ name: "garbage input says Invalid date", iso: "not a date" }])("$name", ({ iso }) => {
    const { container } = render(<LocalDateTime iso={iso} />);
    expect(screen.getByText("Invalid date")).toBeVisible();
    expect(container.querySelector("time")).toBeNull();
  });
});
