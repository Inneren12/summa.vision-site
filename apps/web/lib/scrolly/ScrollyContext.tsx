import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface StepDefinition {
  id: string;
  element: HTMLElement | null;
}

export interface ScrollyContextValue {
  activeStepId: string | null;
  setActiveStepId: (stepId: string | null) => void;
  steps: StepDefinition[];
}

const ScrollyContext = createContext<ScrollyContextValue | null>(null);

export interface ScrollyProviderProps {
  readonly children: ReactNode;
  readonly steps: StepDefinition[];
  readonly initialStepId?: string | null;
}

export function ScrollyProvider({ children, steps, initialStepId = null }: ScrollyProviderProps) {
  const [activeStepId, setActiveStepId] = useState<string | null>(initialStepId);

  const value = useMemo(
    () => ({
      activeStepId,
      setActiveStepId,
      steps,
    }),
    [activeStepId, steps],
  );

  return <ScrollyContext.Provider value={value}>{children}</ScrollyContext.Provider>;
}

export function useScrollyContext() {
  const context = useContext(ScrollyContext);

  if (context === null) {
    throw new Error("useScrollyContext must be used within a ScrollyProvider");
  }

  return context;
}

export { ScrollyContext };
