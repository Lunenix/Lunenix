"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ThemeToggleMenuItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <DropdownMenuItem disabled>
        <Sun className="mr-2 h-4 w-4" />
        Theme
      </DropdownMenuItem>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="mr-2 h-4 w-4" />
      ) : (
        <Moon className="mr-2 h-4 w-4" />
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </DropdownMenuItem>
  );
}
