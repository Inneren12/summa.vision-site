import type { JSX } from "react";

/**
 * Canonical visualization specification types used across the viz adapters.
 *
 * - Vega-Lite v6.4.1: {@link https://vega.github.io/vega-lite/docs/spec.html TopLevelSpec}
 * - Apache ECharts v5.6.0: {@link https://echarts.apache.org/en/option.html EChartsOption}
 * - MapLibre GL JS v5.10.0: {@link https://maplibre.org/maplibre-gl-js/docs/style-spec/ StyleSpecification}
 */
export type VegaLiteSpec = import("vega-lite").TopLevelSpec;
export type EChartsOption = import("echarts").EChartsOption;
export type MapLibreStyle = import("maplibre-gl").StyleSpecification;

export type MapLibrePadding = Partial<Record<"top" | "right" | "bottom" | "left", number>>;

export interface MapLibreLayerInstruction {
  readonly id: string;
  readonly op: "add" | "remove" | "update";
  readonly def?: unknown;
}

export interface MapLibreSpec {
  readonly style: string | MapLibreStyle;
  readonly camera?: {
    readonly center?: [number, number];
    readonly zoom?: number;
    readonly bearing?: number;
    readonly pitch?: number;
    readonly padding?: MapLibrePadding;
  };
  readonly layers?: ReadonlyArray<MapLibreLayerInstruction>;
}

type DeckProps = import("@deck.gl/core").DeckProps;

export interface DeckMapControl {
  onAdd(map: DeckMapInstance): HTMLElement | void;
  onRemove(): void;
}

export interface DeckMapInstance {
  addControl(control: DeckMapControl, position?: string): void;
  removeControl(control: DeckMapControl): void;
}

export interface DeckMapBridge {
  readonly map: DeckMapInstance;
  readonly position?: string;
  readonly interleaved?: boolean;
}

export interface DeckSpec extends DeckProps {
  readonly layers: NonNullable<DeckProps["layers"]>;
  readonly viewState?: DeckProps["viewState"];
  readonly map?: DeckMapBridge;
}

export interface VisxAccessibilityMetadata {
  readonly titleId: string;
  readonly descriptionId: string;
  readonly title?: string;
  readonly description?: string;
}

export type VisxRenderer<TProps extends Record<string, unknown> = Record<string, unknown>> = (
  props: TProps & {
    readonly discrete: boolean;
    readonly width?: number;
    readonly height?: number;
    readonly accessibility: VisxAccessibilityMetadata;
  },
) => JSX.Element;

/**
 * Minimal spec shape for visx-backed charts. This is a temporary structure until
 * we formalise a full schema for declarative visx specs.
 */
export interface VisxSpec<TProps extends Record<string, unknown> = Record<string, unknown>> {
  readonly kind: "visx";
  readonly width?: number;
  readonly height?: number;
  readonly component: VisxRenderer<TProps>;
  readonly props?: TProps;
  readonly title?: string;
  readonly description?: string;
}
