import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

it.each([{ name: "picking Dark reports dark and closes", pick: "Dark", expected: "dark" }])(
  "DropdownMenu $name",
  async ({ pick, expected }) => {
    const onValueChange = vi.fn<(value: string) => void>();
    const user = userEvent.setup({ delay: null });
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="system" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("menuitemradio", { name: pick }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(expected);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  },
);
