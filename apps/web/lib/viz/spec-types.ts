import type { JSX } from "react";

export type VegaLiteSpec = import("vega-lite").TopLevelSpec;

export interface EChartsSpec extends Record<string, unknown> {
  readonly title?: Record<string, unknown>;
  readonly legend?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
  readonly tooltip?: Record<string, unknown>;
  readonly dataset?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
  readonly grid?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
  readonly xAxis?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
  readonly yAxis?: Record<string, unknown> | ReadonlyArray<Record<string, unknown>>;
  readonly series?: ReadonlyArray<Record<string, unknown>>;
  readonly color?: ReadonlyArray<string>;
}

export type MapLibreLayerDefinition = Record<string, unknown>;
export type MapLibreStyle = Record<string, unknown>;
export type MapLibrePadding = Partial<Record<"top" | "right" | "bottom" | "left", number>>;

export interface MapLibreSpec {
  readonly style: string | MapLibreStyle;
  readonly camera?: {
    readonly center?: [number, number];
    readonly zoom?: number;
    readonly bearing?: number;
    readonly pitch?: number;
    readonly padding?: MapLibrePadding;
  };
  readonly layers?: Array<{
    readonly id: string;
    readonly op: "add" | "remove" | "update";
    readonly def?: MapLibreLayerDefinition;
  }>;
}

export type VisxRenderer<TProps extends Record<string, unknown> = Record<string, unknown>> = (
  props: TProps & { readonly discrete: boolean },
) => JSX.Element;

export interface VisxSpec<TProps extends Record<string, unknown> = Record<string, unknown>> {
  readonly width?: number;
  readonly height?: number;
  readonly component: VisxRenderer<TProps>;
  readonly props?: TProps;
}
