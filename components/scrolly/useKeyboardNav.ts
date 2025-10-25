import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useStoryContext } from "./Story";

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable]",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
  "[role='combobox']",
  "[role='spinbutton']",
  "[role='slider']",
  "iframe",
  "embed",
  "object",
].join(",");

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export default function useKeyboardNav(stepId: string) {
  const { focusStepByOffset, focusFirstStep, focusLastStep } = useStoryContext();

  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      if (isInteractiveElement(event.target)) {
        return;
      }

      let handled = false;

      switch (event.key) {
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
      }
    },
    [focusFirstStep, focusLastStep, focusStepByOffset, stepId],
  );
}
