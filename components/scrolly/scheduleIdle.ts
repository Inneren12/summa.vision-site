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

export function scheduleIdle(task: IdleTask, opts?: { timeout?: number }): IdleHandle {
  const w = getIdleWindow();
  if (w && typeof w.requestIdleCallback === "function") {
    const o = opts?.timeout ? { timeout: opts.timeout } : undefined;
    return w.requestIdleCallback(() => { try { task(); } catch {} }, o as any);
  }
  // Fallback для jsdom/SSR/старых браузеров
  return setTimeout(task, opts?.timeout ?? 0);
}

export function cancelIdle(handle: IdleHandle): void {
  const w = getIdleWindow();
  if (typeof handle === "number" && w && typeof w.cancelIdleCallback === "function") {
    w.cancelIdleCallback(handle);
    return;
  }
  clearTimeout(handle as any);
}
