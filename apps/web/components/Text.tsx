import { type ComponentPropsWithoutRef, type ElementType } from "react";

type TextProps<T extends ElementType> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

export function Text<T extends ElementType = "p">({ as, className = "", ...props }: TextProps<T>) {
  const Component = (as ?? "p") as ElementType;
  const classes = ["text-[15px] leading-6 text-fg", className].filter(Boolean).join(" ");

  return <Component className={classes} {...props} />;
}
