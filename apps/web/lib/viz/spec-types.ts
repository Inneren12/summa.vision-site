import type { JSX } from "react";

export type VegaLiteSpec = import("vega-lite").TopLevelSpec;
export type EChartsSpec = import("echarts").EChartsOption;

export type MapLibrePadding = Partial<Record<"top" | "right" | "bottom" | "left", number>>;

export interface MapLibreLayerInstruction {
  readonly id: string;
  readonly op: "add" | "remove" | "update";
  readonly def?: unknown;
}

export interface MapLibreSpec {
  readonly style: string | object;
  readonly camera?: {
    readonly center?: [number, number];
    readonly zoom?: number;
    readonly bearing?: number;
    readonly pitch?: number;
    readonly padding?: MapLibrePadding;
  };
  readonly layers?: ReadonlyArray<MapLibreLayerInstruction>;
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
