import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it.each([
    {
      name: "both cursors give both links",
      prev: "p1",
      next: "n1",
      earlier: "/dashboard?before=p1",
      later: "/dashboard?after=n1",
    },
    {
      name: "no previous cursor disables Earlier",
      prev: null,
      next: "n1",
      earlier: null,
      later: "/dashboard?after=n1",
    },
    {
      name: "no next cursor disables Later",
      prev: "p1",
      next: null,
      earlier: "/dashboard?before=p1",
      later: null,
    },
    { name: "no cursors disables both", prev: null, next: null, earlier: null, later: null },
  ])("$name", ({ prev, next, earlier, later }) => {
    render(<Pagination basePath="/dashboard" prevCursor={prev} nextCursor={next} />);

    for (const [label, href] of [
      ["Earlier", earlier],
      ["Later", later],
    ] as const) {
      if (href) {
        expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
      } else {
        expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: label })).toBeDisabled();
      }
    }
  });
});
