import type { ComponentPropsWithoutRef } from "react";

export type SpinnerProps = ComponentPropsWithoutRef<"div">;

export function Spinner({ className = "", ...props }: SpinnerProps) {
  const classes = [
    "h-5 w-5 animate-spin rounded-full border-2 border-muted/30 border-t-primary",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div role="progressbar" aria-label="Loading" className={classes} {...props} />;
}
