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

export interface VisxSpec<TProps extends Record<string, unknown> = Record<string, unknown>> {
  readonly width?: number;
  readonly height?: number;
  readonly component: VisxRenderer<TProps>;
  readonly props?: TProps;
  readonly title?: string;
  readonly description?: string;
}
