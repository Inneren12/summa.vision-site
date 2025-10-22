import { forwardRef, type ComponentPropsWithoutRef } from "react";

export interface InputProps extends ComponentPropsWithoutRef<"input"> {
  invalid?: boolean;
}

const baseClasses =
  "block w-full rounded border bg-bg px-3 py-1.5 text-sm text-fg shadow-sm transition placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid = false, ...props },
  ref,
) {
  const classes = [
    baseClasses,
    invalid ? "border-red-500 focus-visible:ring-red-500/40" : "border-muted/30",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <input ref={ref} className={classes} aria-invalid={invalid || undefined} {...props} />;
});
