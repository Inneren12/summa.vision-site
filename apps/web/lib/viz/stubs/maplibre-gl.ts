// Минимальная заглушка для maplibre-gl
export type StyleSpecification = Record<string, unknown>;
export type LngLatLike = [number, number] | { lng: number; lat: number };

export interface MapOptions {
  container?: HTMLElement | string;
  style: string | StyleSpecification;
  center?: LngLatLike;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  attributionControl?: boolean;
  antialias?: boolean;
  hash?: boolean | string;
  preserveDrawingBuffer?: boolean;
}

function throwMissingLibrary(): never {
  throw new Error(
    "[viz-stub] maplibre-gl не установлен. Установите пакет, чтобы использовать MapLibre-адаптер.",
  );
}

export class Map {
  constructor(_options: MapOptions) {
    void _options;
    throwMissingLibrary();
  }
  remove(): void {
    throwMissingLibrary();
  }
  resize(): void {
    throwMissingLibrary();
  }
  setStyle(_style: MapOptions["style"], _options?: { diff?: boolean }): void {
    void _style;
    void _options;
    throwMissingLibrary();
  }
  setCenter(_center: LngLatLike): void {
    void _center;
    throwMissingLibrary();
  }
  setZoom(_zoom: number): void {
    void _zoom;
    throwMissingLibrary();
  }
  setPitch(_pitch: number, _options?: { duration?: number }): void {
    void _pitch;
    void _options;
    throwMissingLibrary();
  }
  setBearing(_bearing: number, _options?: { duration?: number }): void {
    void _bearing;
    void _options;
    throwMissingLibrary();
  }
  addControl(_control: unknown, _position?: string): void {
    void _control;
    void _position;
    throwMissingLibrary();
  }
  removeControl(_control: unknown): void {
    void _control;
    throwMissingLibrary();
  }
  on(_event: string, _handler: (...args: unknown[]) => void): void {
    void _event;
    void _handler;
    throwMissingLibrary();
  }
  off(_event: string, _handler: (...args: unknown[]) => void): void {
    void _event;
    void _handler;
    throwMissingLibrary();
  }
  once(_event: string, _handler: (...args: unknown[]) => void): void {
    void _event;
    void _handler;
    throwMissingLibrary();
  }
  isStyleLoaded(): boolean {
    throwMissingLibrary();
  }
  getCanvas(): HTMLCanvasElement {
    throwMissingLibrary();
  }
}

export class NavigationControl {
  constructor(_options?: { showCompass?: boolean; visualizePitch?: boolean }) {
    void _options;
    throwMissingLibrary();
  }
}

export class AttributionControl {
  constructor(_options?: { compact?: boolean; customAttribution?: string | string[] }) {
    void _options;
    throwMissingLibrary();
  }
}

const maplibregl = { Map, NavigationControl, AttributionControl };
export default maplibregl;
