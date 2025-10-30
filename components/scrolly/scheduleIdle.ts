export type IdleTask = () => void;

type IdleCapableWindow = Window & {
  requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
  cancelIdleCallback?: (id: number) => void;
};

function getIdleWindow(): IdleCapableWindow | undefined {
  try {
    return typeof window !== "undefined" ? (window as IdleCapableWindow) : undefined;
  } catch {
    return undefined;
  }
}

export type IdleHandle = number | ReturnType<typeof setTimeout>;

export function cancelIdle(handle: IdleHandle): void {
  const w = getIdleWindow();
  if (w && typeof w.cancelIdleCallback === "function" && typeof handle === "number") {
    w.cancelIdleCallback(handle);
    return;
  }
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

/** Планирует task в idle и возвращает функцию отмены. SSR/jsdom-safe. */
export function scheduleIdle(task: IdleTask, opts?: { timeout?: number }): () => void {
  const w = getIdleWindow();
  if (w && typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(
      () => {
        try {
          task();
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("scheduleIdle task failed", error);
          }
        }
      },
      opts?.timeout !== undefined ? { timeout: opts.timeout } : undefined,
    );
    return () => cancelIdle(id);
  }
  const id = setTimeout(task, opts?.timeout ?? 0);
  return () => cancelIdle(id);
}
