"use client";

import type { ReactNode } from "react";

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export type StickyPanelProps<T extends keyof JSX.IntrinsicElements = "div"> = {
  children: ReactNode;
  className?: string;
  as?: T;
} & Omit<JSX.IntrinsicElements[T], "children" | "className">;

const StickyPanel = <T extends keyof JSX.IntrinsicElements = "div">({
  children,
  className,
  as,
  ...rest
}: StickyPanelProps<T>) => {
  const Component = (as ?? "div") as keyof JSX.IntrinsicElements;
  return (
    <Component
      className={classNames("scrolly-sticky", className)}
      data-scrolly-sticky
      {...(rest as JSX.IntrinsicElements[T])}
    >
      {children}
    </Component>
  );
};

StickyPanel.displayName = "StickyPanel";

export default StickyPanel;
