"use client";

import { useCallback, useMemo, type CSSProperties, type HTMLAttributes } from "react";

import type { VizLifecycleEvent } from "./types";
import { useVizMount, type VizAdapterSource } from "./useVizMount";

export type { VizHarnessEventDetail } from "./VizHarnessLegacy";
export { LegacyVizHarness } from "./VizHarnessLegacy";

export type VizHarnessProps<S, Spec = unknown, Data = unknown> = {
  readonly adapter: VizAdapterSource<S, Spec, Data>;
  readonly spec?: Spec;
  readonly data?: Data;
  readonly state?: Readonly<S>;
  readonly height?: number;
  readonly testId?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
  readonly discrete?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "style" | "children">;

function throttle<TArgs extends unknown[]>(fn: (...args: TArgs) => void, ms = 120) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const invoke = (args: TArgs) => {
    last = Date.now();
    timer = null;
    fn(...args);
  };

  return (...args: TArgs) => {
    const now = Date.now();
    if (!last || now - last >= ms) {
      invoke(args);
      return;
    }
    if (!timer) {
      timer = setTimeout(() => invoke(args), ms - (now - last));
    }
  };
}

export default function VizHarness<S, Spec = unknown, Data = unknown>({
  adapter,
  spec,
  data,
  state,
  height = 420,
  testId = "viz-root",
  className,
  style,
  onEvent,
  discrete,
  ...rest
}: VizHarnessProps<S, Spec, Data>) {
  const registerResizeObserver = useMemo(() => {
    return (element: HTMLElement, cb: () => void) => {
      if (
        typeof window === "undefined" ||
        !(window as typeof window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
      ) {
        return () => {};
      }

      const ResizeObserverCtor = (
        window as typeof window & { ResizeObserver?: typeof ResizeObserver }
      ).ResizeObserver;
      if (!ResizeObserverCtor) {
        return () => {};
      }

      const handler = throttle(cb, 120);
      const observer = new ResizeObserverCtor(() => {
        handler();
      });
      observer.observe(element);

      return () => {
        try {
          observer.unobserve(element);
          observer.disconnect();
        } catch {
          // ignore cleanup errors
        }
      };
    };
  }, []);

  const { ref } = useVizMount<S, Spec, Data>({
    adapter,
    spec,
    data,
    initialState: state as S | undefined,
    discrete,
    onEvent,
    enableResizeObserver: false,
    registerResizeObserver,
  });

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref(node);
    },
    [ref],
  );

  const resolvedClassName = useMemo(() => {
    const base = "w-full max-w-full min-w-[1px] block";
    return className ? `${base} ${className}` : base;
  }, [className]);

  const resolvedStyle = useMemo(() => {
    const base: CSSProperties = {
      height,
      position: "relative",
      contain: "layout size",
    };
    return style ? { ...base, ...style } : base;
  }, [height, style]);

  return (
    <div
      {...rest}
      ref={handleRef}
      data-testid={testId}
      className={resolvedClassName}
      style={resolvedStyle}
      aria-label="visualization"
      role="figure"
    />
  );
}
