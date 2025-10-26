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
