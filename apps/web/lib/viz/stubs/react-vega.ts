// Lightweight stub for react-vega used in tests.
import type { FC } from "react";

export interface ReactVegaProps {
  readonly spec?: Record<string, unknown>;
}

export const VegaLite: FC<ReactVegaProps> = () => null;

export default {
  VegaLite,
};
