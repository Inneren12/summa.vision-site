export type CanonicalDatum = Record<string, string | number | boolean | null | Date>;
export type CanonicalData = CanonicalDatum[];

export type CanonicalViewType = "bar" | "line" | "point";

export interface CanonicalView {
  readonly x: string;
  readonly y: string;
  readonly color?: string;
  readonly type: CanonicalViewType;
}
