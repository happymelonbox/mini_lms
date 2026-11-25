import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";

it.each([
  { name: "closes with the Close button", close: "click" },
  { name: "closes on Escape", close: "escape" },
])("Dialog $name", async ({ close }) => {
  const user = userEvent.setup();
  render(
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Details</DialogTitle>
        <DialogDescription>More info</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Open" }));
  expect(screen.getByRole("dialog", { name: "Details" })).toBeInTheDocument();
  if (close === "click") await user.click(screen.getByRole("button", { name: "Close" }));
  else await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
