import type { JSX } from "react";

/**
 * Canonical spec types for all external viz adapters.
 * NOTE: Only type-level imports; no runtime deps are introduced.
 */

/** Vega-Lite top-level spec (provided via ambient stub or the real types) */
export type VegaLiteSpec = import("vega-lite").TopLevelSpec;

/** ECharts spec: keep broad to avoid pulling runtime typings */
export type EChartsSpec = Record<string, unknown>;
export type EChartsOption = EChartsSpec;

/** MapLibre GL style (minimal structural contract we rely on) */
export type MapLibreStyle = {
  version: number;
  sources: Record<string, unknown>;
  layers: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

/** Visx (we keep adapter-agnostic, data-driven configs) */
export type VisxSpec = Record<string, unknown>;

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
export interface VisxComponentSpec<TProps extends Record<string, unknown> = Record<string, unknown>>
  extends VisxSpec {
  readonly kind: "visx";
  readonly width?: number;
  readonly height?: number;
  readonly component: VisxRenderer<TProps>;
  readonly props?: TProps;
  readonly title?: string;
  readonly description?: string;
}
