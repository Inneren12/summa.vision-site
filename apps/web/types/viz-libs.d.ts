declare module "echarts" {
  export type EChartsOption = Record<string, unknown>;
  export type ECharts = {
    setOption(option: EChartsOption, opts?: Record<string, unknown>): void;
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
  }
  export class Map {
    constructor(options: MapOptions);
    setStyle(style: MapOptions["style"], opts?: { diff?: boolean }): void;
    setCenter(center: LngLatLike): void;
    setZoom(zoom: number): void;
    setPitch(pitch: number, opts?: { duration?: number }): void;
    setBearing(bearing: number, opts?: { duration?: number }): void;
    getStyle(): { sprite?: string } | undefined;
    remove(): void;
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
