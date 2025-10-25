"use client";

import { usePrefersReducedMotion } from "@root/components/motion/prefersReducedMotion";
import type { ComponentPropsWithoutRef } from "react";

export type SpinnerProps = ComponentPropsWithoutRef<"div">;

export function Spinner({ className = "", ...props }: SpinnerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const classes = [
    "h-5 w-5 rounded-full border-2 border-muted/30 border-t-primary",
    prefersReducedMotion ? "" : "animate-spin",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div role="progressbar" aria-label="Loading" className={classes} {...props} />;
}
