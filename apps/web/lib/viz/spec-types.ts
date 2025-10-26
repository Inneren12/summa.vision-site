import type { JSX } from "react";
import type { TopLevelSpec as VegaLiteTopLevelSpec } from "vega-lite";

export type VegaLiteSpec = VegaLiteTopLevelSpec;

export type EChartsSpec = import("echarts").EChartsOption;

export type MapLibreLayerDefinition = import("maplibre-gl").AnyLayer;
export type MapLibreStyle = import("maplibre-gl").StyleSpecification;
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
