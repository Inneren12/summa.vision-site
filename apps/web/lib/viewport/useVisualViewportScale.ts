import { useEffect, useState } from "react";

import {
  VISUAL_VIEWPORT_SCALE_EVENT,
  readVisualViewportScale,
  type VisualViewportScaleChangeDetail,
} from "./visualViewportScale";

const STATE_EPSILON = 0.0005;

function withEpsilon(prev: number, next: number): number {
  return Math.abs(prev - next) > STATE_EPSILON ? next : prev;
}

export default function useVisualViewportScale(): number {
  const [scale, setScale] = useState(() => readVisualViewportScale());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const update = (candidate?: number) => {
      setScale((prev) => {
        const next = candidate ?? readVisualViewportScale();
        return withEpsilon(prev, next);
      });
    };

    const handleScaleEvent = (event: Event) => {
      if (event instanceof CustomEvent) {
        const detail = event.detail as VisualViewportScaleChangeDetail | undefined;
        if (detail && typeof detail.scale === "number") {
          update(detail.scale);
          return;
        }
      }
      update();
    };

    update();

    window.addEventListener(VISUAL_VIEWPORT_SCALE_EVENT, handleScaleEvent as EventListener);

    return () => {
      window.removeEventListener(VISUAL_VIEWPORT_SCALE_EVENT, handleScaleEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setScale((prev) => withEpsilon(prev, readVisualViewportScale()));
    };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return scale;
}
