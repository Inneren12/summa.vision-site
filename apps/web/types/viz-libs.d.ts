declare module "vega-embed" {
  export type VisualizationSpec = Record<string, unknown>;
  type Embed = (
    element: HTMLElement,
    spec: VisualizationSpec,
    options?: Record<string, unknown>,
  ) => Promise<{ view?: { finalize?: () => void } }>;
  const embed: Embed;
  export default embed;
}

declare module "vega-lite" {
  export interface TopLevelSpec extends Record<string, unknown> {
    $schema?: string;
    description?: string;
    title?: string | Record<string, unknown>;
    data?: Record<string, unknown>;
    mark?: string | Record<string, unknown>;
    encoding?: Record<string, unknown>;
    transform?: ReadonlyArray<Record<string, unknown>>;
    params?: ReadonlyArray<Record<string, unknown>>;
    projection?: Record<string, unknown>;
    layer?: ReadonlyArray<TopLevelSpec>;
    hconcat?: ReadonlyArray<TopLevelSpec>;
    vconcat?: ReadonlyArray<TopLevelSpec>;
    repeat?: Record<string, unknown>;
    resolve?: Record<string, unknown>;
    config?: Record<string, unknown>;
    selection?: Record<string, unknown>;
    width?: number | "container";
    height?: number | "container";
    autosize?: string | Record<string, unknown>;
    background?: string;
  }
}

declare module "echarts" {
  export type EChartsOption = Record<string, unknown>;
  export type ECharts = {
    setOption(option: EChartsOption, opts?: Record<string, unknown>): void;
    resize(): void;
    dispose(): void;
  };
  export function init(
    element: HTMLElement,
    theme?: string | object,
    opts?: { renderer?: "canvas" | "svg" },
  ): ECharts;
}

declare module "maplibre-gl" {
  export type LngLatLike = [number, number] | { lng: number; lat: number };
  export interface MapOptions {
    style: string | Record<string, unknown>;
    center?: LngLatLike;
    zoom?: number;
    pitch?: number;
    bearing?: number;
    container?: HTMLElement;
    attributionControl?: boolean;
  }
  export class Map {
    constructor(options: MapOptions);
    setStyle(style: MapOptions["style"], opts?: { diff?: boolean }): void;
    setCenter(center: LngLatLike): void;
    setZoom(zoom: number): void;
    setPitch(pitch: number, opts?: { duration?: number }): void;
    setBearing(bearing: number, opts?: { duration?: number }): void;
    getStyle(): { sprite?: string } | undefined;
    addControl(control: unknown, position?: string): void;
    once(type: string, listener: () => void): void;
    resize(): void;
    remove(): void;
  }
  export class NavigationControl {
    constructor(options?: { showCompass?: boolean; visualizePitch?: boolean });
  }
  export class AttributionControl {
    constructor(options?: { compact?: boolean; customAttribution?: string | string[] });
  }
}

declare module "@deck.gl/core" {
  export interface DeckProps {
    layers?: unknown[];
    controller?: unknown;
    parent?: HTMLElement;
    [key: string]: unknown;
  }
  export class Deck {
    constructor(props: DeckProps);
    setProps(props: DeckProps): void;
    finalize(): void;
  }
}

declare module "@deck.gl/mapbox" {
  import type { DeckProps } from "@deck.gl/core";

  export interface MapboxOverlayProps extends DeckProps {
    id?: string;
    interleaved?: boolean;
  }

  export class MapboxOverlay {
    constructor(props: MapboxOverlayProps);
    setProps(props: MapboxOverlayProps): void;
    onAdd(map: unknown): HTMLElement;
    onRemove(): void;
    finalize(): void;
  }
}
