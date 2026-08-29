"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { setTheme, resolvedTheme: theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full shadow bg-transparent"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-180 dark:scale-0 duration-500" />
      <Moon className="absolute size-5 rotate-180 scale-0 transition-all dark:rotate-0 dark:scale-100 duration-500" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}