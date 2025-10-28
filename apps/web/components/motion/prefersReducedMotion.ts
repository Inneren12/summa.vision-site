import { useReducedMotion } from "@root/components/motion/useReducedMotion";

export function usePrefersReducedMotion(): boolean {
  const { isReducedMotion } = useReducedMotion();
  return isReducedMotion;
}
