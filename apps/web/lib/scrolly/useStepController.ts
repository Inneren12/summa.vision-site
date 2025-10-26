import { useCallback, useEffect, useRef, useState } from "react";

export type OnStepChange = (id: string, prevId: string | null) => void;

export type ControllerOptions = {
  onStepChange?: OnStepChange;
};

export function useStepController({ onStepChange }: ControllerOptions = {}) {
  const entriesRef = useRef<Map<string, HTMLElement>>(new Map());
  const activeStepRef = useRef<string | null>(null);

  // публичное состояние (для отображения/тестов)
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const register = useCallback((id: string, el: HTMLElement) => {
    entriesRef.current.set(id, el);
    // Если ещё нет активного шага — активируем первый зарегистрированный
    if (activeStepRef.current == null) {
      activeStepRef.current = id;
      setActiveStep(id);
      onStepChange?.(id, null);
    }
  }, [onStepChange]);

  const unregister = useCallback((id: string) => {
    entriesRef.current.delete(id);
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
        return;
      }
      // если null — не трогаем состояние (сохраняем предыдущее)
    },
    [onStepChange],
  );

  useEffect(() => {
    const entries = entriesRef.current; // снапшот для cleanup
    return () => {
      void entries;
    };
  }, []);

  return { register, unregister, applyActive, activeStep, entriesRef, activeStepRef };
}
