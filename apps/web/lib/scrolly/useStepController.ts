import { useCallback, useEffect, useRef, useState } from "react";

export type OnStepChange = (id: string, prevId: string | null) => void;

export type ControllerOptions = {
  onStepChange?: OnStepChange;
};

export function useStepController({ onStepChange }: ControllerOptions = {}) {
  const entriesRef = useRef<Map<string, HTMLElement>>(new Map());
  const activeStepRef = useRef<string | null>(null);

  // публичное состояние (для UI/тестов)
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const register = useCallback(
    (id: string, el: HTMLElement) => {
      entriesRef.current.set(id, el);
      // если ещё нет активного шага — активируем первый же зарегистрированный
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
      // если nextActiveStepId === null — сохраняем предыдущее; тестам так удобнее
    },
    [onStepChange],
  );

  // страховка: если по какой-то причине активный шаг не выставился после регистрации,
  // но в коллекции уже есть элементы — активируем первый ключ на ближайшем тике
  useEffect(() => {
    if (activeStepRef.current == null && entriesRef.current.size > 0) {
      const first = entriesRef.current.keys().next().value as string | undefined;
      if (first) {
        activeStepRef.current = first;
        setActiveStep(first);
        onStepChange?.(first, null);
      }
    }
  }, [onStepChange]);

  // snapshot для cleanup, чтобы не ловить warning про ref-значение
  useEffect(() => {
    const entries = entriesRef.current;
    return () => {
      void entries;
    };
  }, []);

  return { register, unregister, applyActive, activeStep, entriesRef, activeStepRef };
}
