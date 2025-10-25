"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getStepHash } from "@/components/story/MdxStep";
import { scrollStepIntoView, useStepUrlSync } from "@/components/story/step-url";

interface StoryStepDefinition {
  readonly id: string;
  readonly title: string;
  readonly hash?: string;
}

interface StoryStepsProps {
  readonly steps: StoryStepDefinition[];
  readonly children: ReactNode;
}

type StoryStepWithHash = StoryStepDefinition & { readonly hash: string };

export function StorySteps({ steps: inputSteps, children }: StoryStepsProps) {
  const steps = useMemo<StoryStepWithHash[]>(
    () => inputSteps.map((step) => ({ ...step, hash: getStepHash(step.id, step.hash) })),
    [inputSteps],
  );
  const hashToId = useMemo(() => new Map(steps.map((step) => [step.hash, step.id])), [steps]);
  const idToHash = useMemo(() => new Map(steps.map((step) => [step.id, step.hash])), [steps]);
  const [activeStep, setActiveStep] = useState<string>(steps[0]?.id ?? "");
  const containerRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeRef = useRef(activeStep);

  useEffect(() => {
    activeRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    if (!activeStep && steps[0]) {
      setActiveStep(steps[0].id);
      return;
    }
    if (activeStep && !steps.some((step) => step.id === activeStep) && steps[0]) {
      setActiveStep(steps[0].id);
    }
  }, [activeStep, steps]);

  const handleLocationStep = useCallback(
    (hash: string) => {
      const resolvedId = hashToId.get(hash);
      if (resolvedId) {
        setActiveStep(resolvedId);
      }
    },
    [hashToId],
  );

  const activeStepHash = activeStep ? (idToHash.get(activeStep) ?? "") : "";

  useStepUrlSync({
    activeStepId: activeStepHash || null,
    onStepFromUrl: handleLocationStep,
    hashPrefix: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top ||
              b.intersectionRatio - a.intersectionRatio,
          );
        const candidate = visible[0];
        if (!candidate) return;
        const id = candidate.target.getAttribute("data-step-id");
        if (id && id !== activeRef.current) {
          activeRef.current = id;
          setActiveStep(id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.2, 0.4, 0.6, 1] },
    );
    observerRef.current = observer;
    const container = containerRef.current;
    if (container) {
      const nodes = container.querySelectorAll<HTMLElement>("[data-step-id]");
      nodes.forEach((node) => observer.observe(node));
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const handleStepClick = useCallback(
    (id: string) => {
      setActiveStep(id);
      const hash = idToHash.get(id);
      if (hash) {
        scrollStepIntoView(hash, { hashPrefix: "" });
      }
    },
    [idToHash],
  );

  useEffect(() => {
    const observer = observerRef.current;
    const container = containerRef.current;
    if (!observer || !container) {
      return;
    }
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-step-id]"));
    nodes.forEach((node) => observer.observe(node));
    return () => {
      nodes.forEach((node) => observer.unobserve(node));
    };
  }, [steps]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 lg:flex-row">
      <aside className="lg:w-1/3">
        <div className="sticky top-24 space-y-3 rounded-2xl border border-muted/30 bg-bg/70 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold text-fg">Story flow</h2>
          <p className="text-sm text-muted">
            Jump directly to a section or copy the link for a deep link. The active step syncs to
            the URL so refresh and share keep context.
          </p>
          <nav aria-label="Story steps" className="space-y-2">
            {steps.map((step, index) => {
              const isActive = step.id === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isActive
                      ? "bg-primary text-bg shadow-lg"
                      : "bg-transparent text-muted hover:bg-muted/10 focus-visible:text-fg"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Step {index + 1}
                  </span>
                  <span
                    className={`block text-base font-medium ${isActive ? "text-bg" : "text-fg"}`}
                  >
                    {step.title}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
      <section ref={containerRef} className="space-y-24 lg:w-2/3">
        {children}
      </section>
    </div>
  );
}
