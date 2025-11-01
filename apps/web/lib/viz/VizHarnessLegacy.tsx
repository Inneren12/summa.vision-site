"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export interface VizHarnessEventDetail {
  readonly width: number;
  readonly height: number;
}

export interface VizHarnessLegacyProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  readonly children?: ReactNode;
  readonly defaultHeight?: number | string;
  readonly onContainerChange?: (element: HTMLDivElement | null) => void;
  readonly testId?: string;
}

function readSize(element: HTMLDivElement): VizHarnessEventDetail {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

async function waitForNextFrame(): Promise<void> {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function LegacyVizHarness({
  children,
  className,
  style,
  defaultHeight = 400,
  onContainerChange,
  testId,
  ...rest
}: VizHarnessLegacyProps) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      setElement(node);
      onContainerChange?.(node);
    },
    [onContainerChange],
  );

  useEffect(() => {
    const target = element;
    if (!target) {
      return;
    }

    const emit = (type: string, detail: VizHarnessEventDetail) => {
      target.dispatchEvent(
        new CustomEvent<VizHarnessEventDetail>(type, {
          detail,
          bubbles: false,
        }),
      );
    };

    let destroyed = false;
    let raf1: number | null = null;
    let raf2: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupWindowResize: (() => void) | null = null;

    target.dataset.vizReady = "0";
    emit("viz_init", readSize(target));

    const markReady = async () => {
      await waitForNextFrame();
      await waitForNextFrame();
      if (destroyed) {
        return;
      }
      target.dataset.vizReady = "1";
      const detail = readSize(target);
      emit("viz_ready", detail);
      emit("viz_resized", detail);
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          void markReady();
        });
      });
    } else {
      void markReady();
    }

    const emitResize = (detail: VizHarnessEventDetail) => {
      emit("viz_resized", detail);
    };

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        const detail = entry
          ? { width: entry.contentRect.width, height: entry.contentRect.height }
          : readSize(target);
        emitResize(detail);
      });
      resizeObserver.observe(target);
    } else if (typeof window !== "undefined") {
      const handleResize = () => emitResize(readSize(target));
      window.addEventListener("resize", handleResize);
      cleanupWindowResize = () => window.removeEventListener("resize", handleResize);
    }

    return () => {
      destroyed = true;
      if (
        raf1 !== null &&
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(raf1);
      }
      if (
        raf2 !== null &&
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(raf2);
      }
      resizeObserver?.disconnect();
      cleanupWindowResize?.();
      delete target.dataset.vizReady;
    };
  }, [element]);

  const resolvedStyle = useMemo(() => {
    const resolvedHeight = typeof defaultHeight === "number" ? `${defaultHeight}px` : defaultHeight;
    const base: CSSProperties = {
      position: "relative",
      contain: "layout size",
      height: resolvedHeight,
    };
    return { ...base, ...style } as CSSProperties;
  }, [defaultHeight, style]);

  const combinedClassName = useMemo(() => {
    const base = "block w-full max-w-full min-w-[1px]";
    return className ? `${base} ${className}` : base;
  }, [className]);

  return (
    <div
      {...rest}
      ref={handleRef}
      data-testid={testId}
      className={combinedClassName}
      style={resolvedStyle}
    >
      {children}
    </div>
  );
}

export default LegacyVizHarness;
