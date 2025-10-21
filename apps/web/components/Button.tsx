import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={
        "inline-flex items-center justify-center rounded border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium " +
        "text-fg transition hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 " +
        className
      }
      {...props}
    />
  );
}
