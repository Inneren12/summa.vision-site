"use client";

import type React from "react";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type HTMLTag = keyof React.ReactHTML;

type StickyPanelProps<T extends HTMLTag = "div"> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "className" | "children">;

export default function StickyPanel<T extends HTMLTag = "div">({
  as,
  className,
  children,
  ...rest
}: StickyPanelProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={["scrolly-sticky", className].filter(Boolean).join(" ")}
      data-scrolly-sticky
      {...(rest as ComponentPropsWithoutRef<T>)}
    >
      {children}
    </Component>
  );
}
