import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeChartAdapter } from "./adapters/fake";
import { useScrollyBindingViz } from "./useScrollyBindingViz";

import {
  ScrollyProvider,
  useScrollyContext,
  type StepDefinition,
} from "@/lib/scrolly/ScrollyContext";

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

function TestChart() {
  const { ref, currentSpec, activeStepId } = useScrollyBindingViz({
    adapter: async () => fakeChartAdapter,
    lib: "fake",
    states: {
      alpha: ({ previous }) => ({
        activeStepId: "alpha",
        history: [...(previous?.history ?? []), "alpha"],
        ready: true,
      }),
      beta: ({ previous }) => ({
        activeStepId: "beta",
        history: [...(previous?.history ?? []), "beta"],
        ready: true,
      }),
    },
    initialStepId: "alpha",
  });

  return (
    <div
      ref={ref}
      data-testid="viz"
      data-active={activeStepId ?? ""}
      data-history={currentSpec.history.join(",")}
    />
  );
}

function StepDriver({ step }: { step: string }) {
  const { setActiveStepId } = useScrollyContext();
  useEffect(() => {
    setActiveStepId(step);
  }, [setActiveStepId, step]);
  return null;
}

describe("useScrollyBindingViz", () => {
  beforeEach(() => {
    document.cookie = "sv_consent=all";
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps scrolly step changes to visualization state", async () => {
    const steps: StepDefinition[] = [
      { id: "alpha", element: null },
      { id: "beta", element: null },
    ];

    function Harness() {
      const [step, setStep] = useState("alpha");
      return (
        <ScrollyProvider steps={steps} initialStepId="alpha">
          <TestChart />
          <StepDriver step={step} />
          <button type="button" onClick={() => setStep("beta")}>
            Activate beta
          </button>
        </ScrollyProvider>
      );
    }

    render(<Harness />);

    const chart = await screen.findByTestId("viz");
    await waitFor(() => {
      expect(chart.dataset.active).toBe("alpha");
    });

    const button = screen.getByRole("button", { name: "Activate beta" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(chart.dataset.active).toBe("beta");
      expect(chart.dataset.history?.split(",")).toEqual(["alpha", "beta"]);
    });
  });
});
