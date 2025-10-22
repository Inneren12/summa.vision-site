import NextLink, { type LinkProps } from "next/link";
import { type ComponentPropsWithoutRef } from "react";

export type AppLinkProps = LinkProps<string> & ComponentPropsWithoutRef<"a">;

export function Link({ className = "", ...props }: AppLinkProps) {
  const classes = ["underline underline-offset-2 transition hover:opacity-80", className]
    .filter(Boolean)
    .join(" ");

  return <NextLink {...props} className={classes} />;
}
