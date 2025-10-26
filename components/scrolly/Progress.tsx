"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { useStoryContext } from "./Story";

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ProgressProps = {
  className?: string;
  label?: string;
};

export default function Progress({ className, label = "Прогресс истории" }: ProgressProps) {
  const { steps, activeStepId, trackProgressRender, trackProgressClick } = useStoryContext();
  const hasTrackedRender = useRef(false);

  const total = steps.length;
  const activeIndex = useMemo(() => {
    if (!activeStepId) {
      return -1;
    }
    return steps.findIndex((step) => step.id === activeStepId);
  }, [steps, activeStepId]);

  useEffect(() => {
    if (hasTrackedRender.current) {
      return;
    }
    if (total > 1) {
      trackProgressRender();
      hasTrackedRender.current = true;
    }
  }, [total, trackProgressRender]);

  const meterStyle = useMemo<CSSProperties | undefined>(() => {
    if (total <= 1) {
      return undefined;
    }
    const denominator = Math.max(total - 1, 1);
    const ratio = activeIndex <= 0 ? 0 : Math.min(activeIndex / denominator, 1);
    return { "--scrolly-progress-ratio": `${ratio}` } as CSSProperties;
  }, [activeIndex, total]);

  const ariaValueNow = useMemo(
    () => (activeIndex >= 0 ? activeIndex + 1 : undefined),
    [activeIndex],
  );
  const ariaValueText = useMemo(() => {
    if (activeIndex < 0) {
      return undefined;
    }
    const currentStep = steps[activeIndex];
    const trimmedLabel = currentStep?.label?.trim();
    return trimmedLabel || `Шаг ${activeIndex + 1}`;
  }, [activeIndex, steps]);

  if (total <= 1) {
    return null;
  }

  return (
    <nav
      className={classNames("scrolly-progress", className)}
      aria-label="Навигация по шагам истории"
    >
      <div
        className="scrolly-progress__meter"
        role="progressbar"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={ariaValueNow}
        aria-valuetext={ariaValueText}
        style={meterStyle}
      />
      <ol className="scrolly-progress__list">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          const href = `#${step.hash}`;
          const stepLabel = step.label?.trim() || `Шаг ${index + 1}`;

          return (
            <li key={step.id} className="scrolly-progress__item">
              <a
                className={classNames(
                  "scrolly-progress__link",
                  isActive && "scrolly-progress__link--active",
                )}
                href={href}
                aria-current={isActive ? "step" : undefined}
                aria-label={stepLabel}
                onClick={() => trackProgressClick(step.id, index)}
              >
                <span aria-hidden="true" className="scrolly-progress__marker">
                  {index + 1}
                </span>
                <span className="scrolly-progress__sr-only">{stepLabel}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
