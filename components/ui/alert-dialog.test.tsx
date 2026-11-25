import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

it.each([
  { name: "Confirm fires onAction and closes", press: "Confirm", actions: 1 },
  { name: "Cancel closes without acting", press: "Cancel", actions: 0 },
])("AlertDialog $name", async ({ press, actions }) => {
  const onAction = vi.fn();
  const user = userEvent.setup();
  render(
    <AlertDialog>
      <AlertDialogTrigger>Delete</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Sure?</AlertDialogTitle>
        <AlertDialogDescription>Cannot undo</AlertDialogDescription>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onAction}>Confirm</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>,
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("alertdialog", { name: "Sure?" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: press }));
  expect(onAction).toHaveBeenCalledTimes(actions);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
