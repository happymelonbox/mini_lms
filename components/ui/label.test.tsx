import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Label } from "./label";

it.each([{ name: "names the input it points at via htmlFor" }])("Label $name", async () => {
  render(
    <>
      <Label htmlFor="n">Full name</Label>
      <input id="n" />
    </>,
  );
  const input = screen.getByLabelText("Full name");
  await userEvent.setup().click(screen.getByText("Full name"));
  expect(input).toHaveFocus();
});
