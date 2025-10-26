"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { useStoryContext } from "./Story";
import useKeyboardNav from "./useKeyboardNav";

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export type StepProps = {
  id: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  descriptionId?: string;
  anchorId?: string;
};

const INTERSECTION_ROOT_MARGIN = "-35% 0px -35% 0px";
const INTERSECTION_THRESHOLD = 0.5;

const Step = ({ id, title, children, className, descriptionId, anchorId }: StepProps) => {
  const { activeStepId, registerStep, unregisterStep, setActiveStep } = useStoryContext();
  const articleRef = useRef<HTMLElement | null>(null);
  const handleKeyDown = useKeyboardNav(id);
  const domId = anchorId ?? id;
  const stringTitle = typeof title === "string" ? title : undefined;

  useEffect(() => {
    const element = articleRef.current;
    if (!element) {
      return;
    }

    registerStep(id, element, { anchorId: domId, title: stringTitle });
    return () => {
      unregisterStep(id);
    };
  }, [domId, id, registerStep, stringTitle, unregisterStep]);

  useEffect(() => {
    const element = articleRef.current;
    if (!element || typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }

    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= INTERSECTION_THRESHOLD) {
            cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
              setActiveStep(id);
            });
          }
        });
      },
      {
        threshold: INTERSECTION_THRESHOLD,
        rootMargin: INTERSECTION_ROOT_MARGIN,
      },
    );

    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [id, setActiveStep]);

  const titleMarkup = useMemo(() => {
    if (title == null) {
      return null;
    }

    return typeof title === "string" ? (
      <h2 className="scrolly-step__title" id={`${domId}-title`}>
        {title}
      </h2>
    ) : (
      title
    );
  }, [domId, title]);

  const ariaCurrent = activeStepId === id ? "step" : undefined;
  const labelledBy = useMemo(() => {
    if (!title || typeof title !== "string") {
      return undefined;
    }

    return `${domId}-title`;
  }, [domId, title]);

  const stepDescriptionId =
    descriptionId ?? (typeof title === "string" ? `${domId}-body` : undefined);

  return (
    // Keyboard navigation between narrative steps is intentional.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex
    <article
      ref={articleRef}
      id={domId}
      aria-current={ariaCurrent}
      aria-describedby={stepDescriptionId ?? undefined}
      aria-labelledby={labelledBy}
      className={classNames("scrolly-step", className)}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onFocus={() => setActiveStep(id)}
      onKeyDown={handleKeyDown}
    >
      {titleMarkup}
      <div
        className="scrolly-step__body"
        id={typeof stepDescriptionId === "string" ? stepDescriptionId : undefined}
      >
        {children}
      </div>
    </article>
  );
};

Step.displayName = "StoryStep";

export default Step;
