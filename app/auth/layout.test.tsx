import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthLayout from "./layout";

describe("AuthLayout", () => {
  it.each([
    { name: "renders its children", text: "the form" },
    { name: "shows the product name", text: "Mini-LMS" },
  ])("$name", ({ text }) => {
    render(
      <AuthLayout>
        <p>the form</p>
      </AuthLayout>,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
