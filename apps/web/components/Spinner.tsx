"use client";

import type { HTMLAttributes } from "react";

import { usePrefersReducedMotion } from "./motion/prefersReducedMotion";

export function Spinner({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      role="progressbar"
      data-testid="spinner"
      className={[
        "inline-block",
        "align-middle",
        prefersReducedMotion ? "" : "animate-spin",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={!prefersReducedMotion}
      {...props}
    >
      <svg viewBox="0 0 50 50" width="20" height="20" role="presentation">
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="31.4 31.4"
        />
      </svg>
    </div>
  );
}
