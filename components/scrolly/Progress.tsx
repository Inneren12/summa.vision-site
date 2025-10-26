"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { useStoryContext } from "./Story";

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ProgressProps = {
  className?: string;
  ariaLabel?: string;
};

const DEFAULT_ARIA_LABEL = "Прогресс истории";

export default function Progress({ className, ariaLabel = DEFAULT_ARIA_LABEL }: ProgressProps) {
  const { activeStepId, steps, trackProgressClick, trackProgressRender } = useStoryContext();
  const hasMultipleSteps = steps.length > 1;
  const renderTrackedRef = useRef(false);

  useEffect(() => {
    if (!renderTrackedRef.current && hasMultipleSteps) {
      trackProgressRender();
      renderTrackedRef.current = true;
    }
  }, [hasMultipleSteps, trackProgressRender]);

  const activeIndex = useMemo(
    () => steps.findIndex((step) => step.id === activeStepId),
    [activeStepId, steps],
  );

  const ariaValueNow = activeIndex >= 0 ? activeIndex + 1 : undefined;
  const completion = useMemo(() => {
    if (ariaValueNow == null || steps.length === 0) {
      return 0;
    }

    return Math.min(1, Math.max(0, ariaValueNow / steps.length));
  }, [ariaValueNow, steps.length]);

  const meterStyle = useMemo<CSSProperties>(() => {
    const percent = Math.round(completion * 100 * 100) / 100;
    return { ["--scrolly-progress-fill" as const]: `${percent}%` };
  }, [completion]);

  if (!hasMultipleSteps) {
    return null;
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={classNames("scrolly-progress", className)}
      data-scrolly-progress
    >
      <div
        aria-label={ariaLabel}
        aria-valuemax={steps.length}
        aria-valuemin={1}
        aria-valuenow={ariaValueNow}
        className="scrolly-progress__meter"
        role="progressbar"
      >
        <span aria-hidden="true" className="scrolly-progress__meter-track" />
        <span aria-hidden="true" className="scrolly-progress__meter-fill" style={meterStyle} />
      </div>
      <ol className="scrolly-progress__list">
        {steps.map((step) => {
          const isActive = step.id === activeStepId;
          const isComplete = activeIndex >= 0 && step.index < activeIndex;
          const label = step.title ? String(step.title) : `Шаг ${step.index + 1}`;
          const handleClick = () => {
            trackProgressClick(step.id, step.index);
          };

          return (
            <li
              key={step.id}
              className={classNames(
                "scrolly-progress__item",
                isActive && "scrolly-progress__item--active",
                isComplete && "scrolly-progress__item--complete",
              )}
            >
              <a
                aria-current={isActive ? "step" : undefined}
                aria-label={label}
                className="scrolly-progress__link"
                href={`#${step.anchorId}`}
                onClick={handleClick}
              >
                <span aria-hidden="true" className="scrolly-progress__marker">
                  {step.index + 1}
                </span>
                <span className="scrolly-progress__label">{label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
