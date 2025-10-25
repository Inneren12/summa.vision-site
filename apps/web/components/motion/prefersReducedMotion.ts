export function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
