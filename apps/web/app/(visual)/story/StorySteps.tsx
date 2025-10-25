"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { scrollStepIntoView, useStepUrlSync } from "@/components/story/step-url";

interface StoryStep {
  id: string;
  title: string;
  description: string;
}

const HASH_PREFIX = "step-";

const STORY_STEPS: StoryStep[] = [
  {
    id: "baseline",
    title: "Baseline momentum",
    description:
      "Summa Vision’s programmes start by mapping existing community assets and aligning local partners around a shared north star. Baseline data on education, health, and climate risks lets teams focus on leverage points rather than duplicating efforts.",
  },
  {
    id: "activation",
    title: "Activation and pilots",
    description:
      "Pilot projects launch quickly to prove traction—think microgrid pilots, digital skills cohorts, or regenerative agriculture demos. Every activation publishes metrics publicly so peers can replicate what works.",
  },
  {
    id: "scale",
    title: "Scaling with partners",
    description:
      "Once the pilot playbook is solid, it expands with regional delivery partners. Shared infrastructure, toolkits, and funding rails help municipalities and NGOs adopt the blueprint while adapting to local context.",
  },
  {
    id: "impact",
    title: "Measuring real outcomes",
    description:
      "Impact dashboards track emissions avoided, jobs created, and resilience gains. Communities can subscribe to alerts for new data drops, and media kits make it easy to report on progress without waiting for quarterly summaries.",
  },
];

export function StorySteps() {
  const steps = useMemo(() => STORY_STEPS, []);
  const [activeStep, setActiveStep] = useState<string>(steps[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeRef = useRef(activeStep);

  useEffect(() => {
    activeRef.current = activeStep;
  }, [activeStep]);

  const handleLocationStep = useCallback(
    (id: string) => {
      if (!steps.some((step) => step.id === id)) return;
      setActiveStep(id);
    },
    [steps],
  );

  useStepUrlSync({
    activeStepId: activeStep,
    onStepFromUrl: handleLocationStep,
    hashPrefix: HASH_PREFIX,
  });

  const registerSection = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      const previous = sectionRefs.current[id];
      if (observerRef.current && previous) {
        observerRef.current.unobserve(previous);
      }
      sectionRefs.current[id] = node;
      if (observerRef.current && node) {
        observerRef.current.observe(node);
      }
    },
    [],
  );

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
    Object.values(sectionRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const handleStepClick = useCallback((id: string) => {
    setActiveStep(id);
    scrollStepIntoView(id, { hashPrefix: HASH_PREFIX });
  }, []);

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
      <section className="space-y-24 lg:w-2/3">
        {steps.map((step, index) => (
          <article
            key={step.id}
            id={`${HASH_PREFIX}${step.id}`}
            data-step-id={step.id}
            ref={registerSection(step.id)}
            className="story-step-anchor scroll-mt-28 rounded-3xl border border-muted/20 bg-bg/80 p-8 shadow-sm transition"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Step {index + 1}
            </p>
            <h3 className="mt-3 text-3xl font-semibold text-fg">{step.title}</h3>
            <p className="mt-4 text-lg leading-7 text-muted">{step.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
