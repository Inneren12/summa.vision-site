import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useStoryContext } from "./Story";

const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"]);

const ACCEPTS_KEYS_SELECTOR = "[data-accepts-keys='true']";

type KeyboardNavDirection = "next" | "previous" | "first" | "last";

const KEY_DIRECTION: Record<string, KeyboardNavDirection> = {
  ArrowDown: "next",
  PageDown: "next",
  ArrowUp: "previous",
  PageUp: "previous",
  Home: "first",
  End: "last",
};

type KeyboardNavEventName = "kbd_nav" | "kbd_ignored_target";

type KeyboardNavEventDetail = {
  readonly key: string;
  readonly stepId: string;
  readonly direction?: KeyboardNavDirection;
  readonly reason?: "editable" | "accepts_keys";
  readonly timestamp: string;
};

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

const EDITABLE_CLOSEST_SELECTOR = "[role='textbox'],[contenteditable='true']";

const isEditable = (element: Element | null): boolean => {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  if (EDITABLE_TAGS.has(element.tagName)) {
    return true;
  }

  return Boolean(element.closest(EDITABLE_CLOSEST_SELECTOR));
};

function emitKeyboardNavEvent(
  name: KeyboardNavEventName,
  detail: Omit<KeyboardNavEventDetail, "timestamp">,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const event = new CustomEvent<KeyboardNavEventDetail>(name, {
    detail: {
      ...detail,
      timestamp: new Date().toISOString(),
    },
    bubbles: false,
  });

  window.dispatchEvent(event);
}

export default function useKeyboardNav(stepId: string) {
  const { focusStepByOffset, focusFirstStep, focusLastStep } = useStoryContext();

  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      const { key } = event;

      if (!NAVIGATION_KEYS.has(key)) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (isEditable(target)) {
        emitKeyboardNavEvent("kbd_ignored_target", { key, stepId, reason: "editable" });
        return;
      }

      if (target && typeof target.closest === "function" && target.closest(ACCEPTS_KEYS_SELECTOR)) {
        emitKeyboardNavEvent("kbd_ignored_target", { key, stepId, reason: "accepts_keys" });
        return;
      }

      let handled = false;

      switch (key) {
        case "ArrowDown":
        case "PageDown":
          handled = focusStepByOffset(stepId, 1);
          break;
        case "ArrowUp":
        case "PageUp":
          handled = focusStepByOffset(stepId, -1);
          break;
        case "Home":
          handled = focusFirstStep();
          break;
        case "End":
          handled = focusLastStep();
          break;
        default:
          return;
      }

      if (handled) {
        event.preventDefault();
        emitKeyboardNavEvent("kbd_nav", { key, stepId, direction: KEY_DIRECTION[key] });
      }
    },
    [focusFirstStep, focusLastStep, focusStepByOffset, stepId],
  );
}
