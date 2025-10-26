export function installVHVar(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const apply = () => {
    const vv = (window as typeof window & { visualViewport?: VisualViewport }).visualViewport;
    const height = vv?.height ?? window.innerHeight;
    const value = `${height * 0.01}px`;
    document.documentElement.style.setProperty("--vh", value);

    try {
      window.dispatchEvent(
        new CustomEvent("vh_var_update", {
          detail: { height, value },
        }),
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("vh_var_update dispatch failed", error);
      }
    }
  };

  let frame = 0;
  const schedule = () => {
    if (frame) {
      cancelAnimationFrame(frame);
    }
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };

  apply();

  const resizeListener = () => schedule();
  const scrollListener = () => schedule();

  window.addEventListener("resize", resizeListener, { passive: true });

  const vv = (window as typeof window & { visualViewport?: VisualViewport }).visualViewport;
  vv?.addEventListener?.("resize", resizeListener, { passive: true });
  vv?.addEventListener?.("scroll", scrollListener, { passive: true });

  return () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    window.removeEventListener("resize", resizeListener);
    vv?.removeEventListener?.("resize", resizeListener);
    vv?.removeEventListener?.("scroll", scrollListener);
  };
}
