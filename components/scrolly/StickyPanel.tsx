"use client";

import type { ReactNode } from "react";

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export type StickyPanelProps = {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
};

const StickyPanel = ({ children, className, as: Component = "div" }: StickyPanelProps) => {
  return (
    <Component className={classNames("scrolly-sticky", className)} data-scrolly-sticky>
      {children}
    </Component>
  );
};

StickyPanel.displayName = "StickyPanel";

export default StickyPanel;
