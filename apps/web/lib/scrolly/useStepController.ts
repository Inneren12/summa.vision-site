import { useCallback, useEffect, useRef, useState } from "react";

export type OnStepChange = (id: string, prevId: string | null) => void;

export type ControllerOptions = {
  onStepChange?: OnStepChange;
};

export function useStepController({ onStepChange }: ControllerOptions = {}) {
  const entriesRef = useRef<Map<string, HTMLElement>>(new Map());
  const activeStepRef = useRef<string | null>(null);

  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [entriesCount, setEntriesCount] = useState(0);

  const register = useCallback(
    (id: string, el: HTMLElement) => {
      entriesRef.current.set(id, el);
      setEntriesCount(entriesRef.current.size);
      if (activeStepRef.current == null) {
        activeStepRef.current = id;
        setActiveStep(id);
        onStepChange?.(id, null);
      }
    },
    [onStepChange],
  );

  const unregister = useCallback((id: string) => {
    entriesRef.current.delete(id);
    setEntriesCount(entriesRef.current.size);
    if (activeStepRef.current === id) {
      activeStepRef.current = null;
      setActiveStep(null);
    }
  }, []);

  const applyActive = useCallback(
    (nextActiveStepId: string | null) => {
      const prev = activeStepRef.current;
      if (nextActiveStepId && nextActiveStepId !== prev) {
        onStepChange?.(nextActiveStepId, prev ?? null);
        activeStepRef.current = nextActiveStepId;
        setActiveStep(nextActiveStepId);
      }
    },
    [onStepChange],
  );

  // fallback: если регистрация прошла, но актив не выставился из-за порядка —
  // активируем первый зарегистрированный ключ при изменении количества шагов
  useEffect(() => {
    if (activeStepRef.current == null && entriesRef.current.size > 0) {
      const first = entriesRef.current.keys().next().value as string | undefined;
      if (first) {
        activeStepRef.current = first;
        setActiveStep(first);
        onStepChange?.(first, null);
      }
    }
  }, [entriesCount, onStepChange]);

  return { register, unregister, applyActive, activeStep, entriesRef, activeStepRef };
}
