"use client";

// Light, dark or system theme menu.

import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ICON_SIZE = 18;

export function ThemeSwitcher() {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  // The saved theme is only known in the browser; a same-size placeholder keeps the header from shifting.
  if (!mounted) {
    return <span aria-hidden className="h-11 w-11 sm:w-24" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Theme"
          className="sm:w-auto sm:px-3 [&_svg]:size-[18px]"
        >
          {theme === "light" ? (
            <Sun size={ICON_SIZE} className="text-foreground" />
          ) : theme === "dark" ? (
            <Moon size={ICON_SIZE} className="text-foreground" />
          ) : (
            <Laptop size={ICON_SIZE} className="text-foreground" />
          )}
          <span className="hidden sm:inline">Theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem className="flex gap-2" value="light">
            <Sun size={ICON_SIZE} className="text-muted-foreground" />
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex gap-2" value="dark">
            <Moon size={ICON_SIZE} className="text-muted-foreground" />
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex gap-2" value="system">
            <Laptop size={ICON_SIZE} className="text-muted-foreground" />
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
