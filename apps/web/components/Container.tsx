import type { PropsWithChildren } from "react";

interface ContainerProps extends PropsWithChildren {
  className?: string;
}

export function Container({ children, className = "" }: ContainerProps) {
  const classes = ["mx-auto w-full max-w-5xl px-4 lg:px-6", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}
