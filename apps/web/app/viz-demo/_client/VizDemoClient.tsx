"use client";

// Client-only: hosts the interactive viz demo and isolates browser hooks from the server page.

import { useReducedMotion } from "@root/components/motion/useReducedMotion";
import { useMemo, useState } from "react";

import { VizHarness } from "@/lib/viz/VizHarness";
import type { VizAdapter, VizEvent, VizInstance } from "@/lib/viz/types";
import { useVizMount } from "@/lib/viz/useVizMount";

interface DemoState {
  readonly step: string | null;
  readonly clicks: number;
}

interface DemoSpec {
  readonly title: string;
}

interface VizDemoClientProps {
  readonly initialSpec?: DemoSpec;
  readonly initialState?: DemoState;
  readonly discrete?: boolean;
}

const DEFAULT_STATE: DemoState = { step: null, clicks: 0 };
const DEFAULT_SPEC: DemoSpec = { title: "Состояние визуализации" };

type DemoMountArgs = Parameters<VizAdapter<DemoState, DemoSpec>["mount"]>[0];

const demoAdapter: VizAdapter<DemoState, DemoSpec> = {
  async mount({
    el,
    spec,
    initialState,
    onEvent,
    registerResizeObserver,
  }: DemoMountArgs): Promise<VizInstance<DemoState>> {
    const state: DemoState = {
      step: initialState?.step ?? null,
      clicks: initialState?.clicks ?? 0,
    };

    const container = document.createElement("div");
    container.className =
      "flex h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-center";

    const title = document.createElement("p");
    title.className = "text-sm font-medium text-primary";
    title.textContent = spec?.title ?? "Demo";

    const status = document.createElement("div");
    status.className = "text-lg font-semibold";

    const counter = document.createElement("span");
    counter.className = "text-xs text-muted-foreground";

    const sizeLabel = document.createElement("span");
    sizeLabel.className = "text-xs text-muted-foreground";

    container.append(title, status, counter, sizeLabel);
    el.append(container);

    const render = () => {
      status.textContent = state.step ? `Активный шаг: ${state.step}` : "Шаг не выбран";
      counter.textContent = `Обновлений состояния: ${state.clicks}`;
    };

    render();

    const cleanupResize = registerResizeObserver
      ? registerResizeObserver(([entry]) => {
          if (!entry) return;
          const { width, height } = entry.contentRect;
          sizeLabel.textContent = `Размер: ${Math.round(width)}×${Math.round(height)}px`;
        })
      : undefined;

    onEvent?.({ type: "viz_state", ts: Date.now(), meta: { reason: "mounted" } });

    return {
      applyState(next) {
        Object.assign(state, next);
        render();
      },
      destroy() {
        cleanupResize?.();
        el.replaceChildren();
      },
    } satisfies VizInstance<DemoState>;
  },
};

export default function VizDemoClient({ initialSpec, initialState, discrete }: VizDemoClientProps) {
  const steps = useMemo<Array<string | null>>(() => [null, "alpha", "beta", "gamma"], []);
  const [clicks, setClicks] = useState(initialState?.clicks ?? DEFAULT_STATE.clicks);
  const [activeStep, setActiveStep] = useState<string | null>(
    initialState?.step ?? DEFAULT_STATE.step,
  );
  const [events, setEvents] = useState<VizEvent[]>([]);

  const { isReducedMotion } = useReducedMotion();
  const resolvedDiscrete = discrete ?? isReducedMotion;

  const viz = useVizMount<DemoState, DemoSpec>({
    adapter: demoAdapter,
    spec: initialSpec ?? DEFAULT_SPEC,
    initialState: initialState ?? DEFAULT_STATE,
    discrete: resolvedDiscrete,
    onEvent: (event) => {
      setEvents((prev) => [...prev.slice(-4), event]);
    },
  });

  const applyStep = (step: string | null) => {
    const nextClicks = clicks + 1;
    setClicks(nextClicks);
    setActiveStep(step);
    viz.instance?.applyState({ step, clicks: nextClicks });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <VizHarness
          onContainerChange={viz.ref}
          data-active-step={activeStep ?? ""}
          aria-label="Демо визуализации"
          role="group"
          defaultHeight={360}
        />
        <div className="flex flex-wrap gap-3 text-sm">
          {steps.map((step) => (
            <button
              key={step ?? "none"}
              type="button"
              className="rounded-lg border border-muted/30 px-3 py-1 transition-colors hover:border-primary/60"
              data-active={step === activeStep}
              onClick={() => applyStep(step)}
            >
              {step ? `Шаг ${step}` : "Сброс"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Дискретный режим: {viz.discrete ? "включён" : "выключен"} · Обновлений: {clicks}
        </p>
      </section>
      <section aria-live="polite" className="space-y-2">
        <h2 className="text-sm font-semibold">Последние события</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {events.length === 0 ? (
            <li>Событий пока нет</li>
          ) : (
            events
              .slice()
              .reverse()
              .map((event, index) => (
                <li key={`${event.type}-${event.ts}-${index}`}>
                  <span className="font-medium text-primary">{event.type}</span>
                  {event.meta?.reason ? ` · ${String(event.meta.reason)}` : null}
                  <span className="ml-1 text-[10px] uppercase tracking-widest">
                    {new Date(event.ts).toLocaleTimeString()}
                  </span>
                </li>
              ))
          )}
        </ul>
      </section>
    </div>
  );
}
