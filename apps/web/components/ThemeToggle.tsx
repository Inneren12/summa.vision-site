"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "./Button";

const modes = ["system", "light", "dark"] as const;

type Mode = (typeof modes)[number];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = (theme ?? "system") as Mode;
  const resolved = mounted ? (theme === "system" ? resolvedTheme : theme) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span id="theme-toggle-label" className="mr-1 font-medium text-muted">
        Theme:
      </span>
      <div className="inline-flex items-center gap-2" aria-labelledby="theme-toggle-label">
        {modes.map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={activeTheme === mode ? "primary" : "ghost"}
            onClick={() => setTheme(mode)}
            aria-pressed={activeTheme === mode}
          >
            {mode}
          </Button>
        ))}
      </div>
      <span className="text-xs" aria-live="polite">
        now: {mounted ? (resolved ?? "system") : "…"}
      </span>
    </div>
  );
}
