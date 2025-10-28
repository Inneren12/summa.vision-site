import { useReducedMotion } from "./useReducedMotion";

export function usePrefersReducedMotion(): boolean {
  const { isReducedMotion } = useReducedMotion();
  return isReducedMotion;
}
