"use client";

import {
  Children,
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import StickyPanel from "./StickyPanel";

type StoryContextValue = {
  activeStepId: string | null;
  setActiveStep: (stepId: string) => void;
  registerStep: (id: string, element: HTMLElement) => void;
  unregisterStep: (id: string) => void;
  focusStep: (stepId: string) => boolean;
  focusStepByOffset: (currentStepId: string, offset: number) => boolean;
  focusFirstStep: () => boolean;
  focusLastStep: () => boolean;
};

const StoryContext = createContext<StoryContextValue | null>(null);

export function useStoryContext(): StoryContextValue {
  const context = useContext(StoryContext);

  if (!context) {
    throw new Error("useStoryContext must be used within a <Story /> component");
  }

  return context;
}

const isStickyPanel = (child: ReactElement) => child.type === StickyPanel;

export type StoryProps = {
  /**
   * Sticky top offset. Provide a pixel number or CSS length that matches the header height.
   */
  stickyTop?: number | string;
  children: ReactNode;
  className?: string;
};

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export default function Story({ children, stickyTop, className }: StoryProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const stepsRef = useRef(new Map<string, HTMLElement>());
  const orderedStepIdsRef = useRef<string[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const initialHashHandled = useRef(false);

  const setActiveStep = useCallback((stepId: string) => {
    setActiveStepId((current) => (current === stepId ? current : stepId));
  }, []);

  const focusStep = useCallback(
    (stepId: string) => {
      const element = stepsRef.current.get(stepId);
      if (!element || !element.isConnected) {
        return false;
      }

      if (
        typeof element.focus === "function" &&
        (typeof document === "undefined" || document.activeElement !== element)
      ) {
        element.focus({ preventScroll: true });
      }

      setActiveStep(stepId);
      return true;
    },
    [setActiveStep],
  );

  const focusStepByIndex = useCallback(
    (index: number) => {
      if (index < 0) {
        return false;
      }

      const stepId = orderedStepIdsRef.current[index];
      if (!stepId) {
        return false;
      }

      return focusStep(stepId);
    },
    [focusStep],
  );

  const focusStepByOffset = useCallback(
    (currentStepId: string, offset: number) => {
      if (!currentStepId) {
        return false;
      }

      const index = orderedStepIdsRef.current.indexOf(currentStepId);
      if (index < 0) {
        return false;
      }

      return focusStepByIndex(index + offset);
    },
    [focusStepByIndex],
  );

  const focusFirstStep = useCallback(() => focusStepByIndex(0), [focusStepByIndex]);

  const focusLastStep = useCallback(
    () => focusStepByIndex(orderedStepIdsRef.current.length - 1),
    [focusStepByIndex],
  );

  const handleInitialHash = useCallback(() => {
    if (initialHashHandled.current || typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.slice(1);
    if (!hash) {
      return;
    }

    const didFocus = focusStep(hash);
    if (didFocus) {
      initialHashHandled.current = true;
    }
  }, [focusStep]);

  const registerStep = useCallback(
    (id: string, element: HTMLElement) => {
      stepsRef.current.set(id, element);
      if (!orderedStepIdsRef.current.includes(id)) {
        orderedStepIdsRef.current.push(id);
      }
      handleInitialHash();
    },
    [handleInitialHash],
  );

  const unregisterStep = useCallback((id: string) => {
    stepsRef.current.delete(id);
    orderedStepIdsRef.current = orderedStepIdsRef.current.filter((stepId) => stepId !== id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !activeStepId) {
      return;
    }

    const element = stepsRef.current.get(activeStepId);
    if (!element || !element.isConnected) {
      return;
    }

    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;

      if (activeElement && activeElement !== element && element.contains(activeElement)) {
        return;
      }

      if (activeElement === element) {
        return;
      }
    }

    if (typeof document === "undefined" || document.activeElement !== element) {
      element.focus({ preventScroll: true });
    }
  }, [activeStepId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return;
    }

    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      container.style.setProperty("--scrolly-viewport-height", `${viewportHeight}px`);
    };

    updateViewportHeight();

    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (stickyTop == null) {
      container.style.removeProperty("--scrolly-sticky-top");
      return;
    }

    const value = typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop;
    container.style.setProperty("--scrolly-sticky-top", value);
  }, [stickyTop]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeStepId) {
      return;
    }

    const hash = `#${activeStepId}`;

    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, [activeStepId]);

  const contextValue = useMemo<StoryContextValue>(
    () => ({
      activeStepId,
      setActiveStep,
      registerStep,
      unregisterStep,
      focusStep,
      focusStepByOffset,
      focusFirstStep,
      focusLastStep,
    }),
    [
      activeStepId,
      focusFirstStep,
      focusLastStep,
      focusStep,
      focusStepByOffset,
      registerStep,
      setActiveStep,
      unregisterStep,
    ],
  );

  const childArray = Children.toArray(children) as ReactElement[];
  const stickyChild = childArray.find((child) => isStickyPanel(child));
  const stepChildren = childArray.filter((child) => !isStickyPanel(child));

  return (
    <section ref={containerRef} className={classNames("scrolly", className)} data-scrolly>
      <StoryContext.Provider value={contextValue}>
        {stickyChild ?? <div className="scrolly-sticky" aria-hidden="true" />}
        <div className="scrolly-steps">{stepChildren}</div>
      </StoryContext.Provider>
    </section>
  );
}
