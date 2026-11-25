import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ThemeSwitcher } from "./theme-switcher";

const theme = vi.hoisted(() => ({ setTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: theme.setTheme }) }));

beforeEach(() => vi.clearAllMocks());

it.each([
  { name: "Light", expected: "light" },
  { name: "Dark", expected: "dark" },
  { name: "System", expected: "system" },
])("ThemeSwitcher choosing $name", async ({ name, expected }) => {
  const user = userEvent.setup();
  render(<ThemeSwitcher />);
  await user.click(screen.getByRole("button", { name: "Theme" }));
  expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual([
    "Light",
    "Dark",
    "System",
  ]);
  await user.click(screen.getByRole("menuitemradio", { name }));
  expect(theme.setTheme).toHaveBeenCalledWith(expected);
});
