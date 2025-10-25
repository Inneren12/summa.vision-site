export type IdleTask = () => void;

function isWindowAvailable(): window is typeof window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
} {
  return typeof window !== "undefined";
}

export function scheduleIdle(task: IdleTask): () => void {
  if (!isWindowAvailable()) {
    task();
    return () => undefined;
  }

  const win = window as typeof window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(() => {
      task();
    });

    return () => {
      if (typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(handle);
      }
    };
  }

  const timeout = window.setTimeout(() => {
    task();
  }, 0);

  return () => {
    window.clearTimeout(timeout);
  };
}
