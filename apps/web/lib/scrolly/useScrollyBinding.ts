import { useReducedMotion } from "@root/components/motion/useReducedMotion";
import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { useScrollyContext } from "./ScrollyContext";


const DEBOUNCE_DELAY_MS = 32;

export const SCROLLY_BINDING_ACTIVATE_EVENT = "scrolly:activate";

export interface ScrollyBindingHandlerOptions {
  readonly discrete: boolean;
}

export type ScrollyBindingHandler = (options: ScrollyBindingHandlerOptions) => void;

export type ScrollyBindingStatesMap = Record<string, ScrollyBindingHandler | undefined>;

export interface ScrollyBindingEventDetail {
  readonly stepId: string;
  readonly force?: boolean;
}

type PossibleRef<T> = RefObject<T> | MutableRefObject<T>;

interface ScheduleOptions {
  readonly force?: boolean;
}

export function triggerScrollyBinding(
  target: EventTarget,
  detail: ScrollyBindingEventDetail,
): boolean {
  const event = new CustomEvent<ScrollyBindingEventDetail>(SCROLLY_BINDING_ACTIVATE_EVENT, {
    detail,
    bubbles: false,
  });

  return target.dispatchEvent(event);
}

export function useScrollyBinding<T extends EventTarget>(
  chartRef: PossibleRef<T | null>,
  statesMap: ScrollyBindingStatesMap,
): void {
  const { activeStepId } = useScrollyContext();
  const { isReducedMotion } = useReducedMotion();
  const discreteRef = useRef(isReducedMotion);
  const statesRef = useRef(statesMap);
  const previousStepRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  discreteRef.current = isReducedMotion;
  statesRef.current = statesMap;

  const clearScheduled = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runHandler = useCallback((stepId: string, options?: ScheduleOptions) => {
    const handler = statesRef.current[stepId];

    if (!handler) {
      return;
    }

    if (!options?.force && previousStepRef.current === stepId) {
      return;
    }

    previousStepRef.current = stepId;
    handler({ discrete: discreteRef.current });
  }, []);

  const schedule = useCallback(
    (stepId: string, options?: ScheduleOptions) => {
      clearScheduled();

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runHandler(stepId, options);
      }, DEBOUNCE_DELAY_MS);
    },
    [clearScheduled, runHandler],
  );

  useEffect(() => {
    if (!activeStepId) {
      clearScheduled();
      return;
    }

    schedule(activeStepId);

    return clearScheduled;
  }, [activeStepId, clearScheduled, schedule]);

  useEffect(
    () => () => {
      clearScheduled();
    },
    [clearScheduled],
  );

  useEffect(() => {
    const element = chartRef.current;

    if (!element || typeof element.addEventListener !== "function") {
      return undefined;
    }

    const handleActivate = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail = event.detail as ScrollyBindingEventDetail | undefined;

      if (!detail || typeof detail.stepId !== "string" || detail.stepId.length === 0) {
        return;
      }

      schedule(detail.stepId, { force: detail.force });
    };

    element.addEventListener(SCROLLY_BINDING_ACTIVATE_EVENT, handleActivate as EventListener);

    return () => {
      element.removeEventListener(SCROLLY_BINDING_ACTIVATE_EVENT, handleActivate as EventListener);
    };
  }, [chartRef, schedule]);
}
