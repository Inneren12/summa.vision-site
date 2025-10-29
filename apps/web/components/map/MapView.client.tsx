"use client";

import { useEffect, useRef } from "react";

type MapLibreModule = Awaited<typeof import("maplibre-gl")>;
type MapInstance = InstanceType<MapLibreModule["Map"]>;

const DEFAULT_ATTRIBUTION = "© OpenStreetMap contributors, © OpenMapTiles";
const DEFAULT_CENTER: [number, number] = [-0.1276, 51.5072];
const DEFAULT_ZOOM = 10;
const RESIZE_DEBOUNCE_MS = 180;

export type MapViewProps = {
  styleUrl?: string;
  tileUrl?: string;
  attribution?: string;
  center?: [number, number];
  zoom?: number;
  className?: string;
};

function createFallbackStyle(tileUrl: string) {
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      openmaptiles: {
        type: "vector" as const,
        tiles: [tileUrl],
        maxzoom: 14,
      },
    },
    layers: [
      {
        id: "background",
        type: "background" as const,
        paint: {
          "background-color": "#f8fafc",
        },
      },
      {
        id: "water",
        type: "fill" as const,
        source: "openmaptiles",
        "source-layer": "water",
        paint: {
          "fill-color": "#bfdbfe",
        },
      },
      {
        id: "landuse",
        type: "fill" as const,
        source: "openmaptiles",
        "source-layer": "landuse",
        paint: {
          "fill-color": "#fef3c7",
          "fill-opacity": 0.6,
        },
      },
      {
        id: "waterways",
        type: "line" as const,
        source: "openmaptiles",
        "source-layer": "waterway",
        paint: {
          "line-color": "#93c5fd",
          "line-width": 1,
        },
      },
      {
        id: "roads",
        type: "line" as const,
        source: "openmaptiles",
        "source-layer": "transportation",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1.25,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },
      {
        id: "boundaries",
        type: "line" as const,
        source: "openmaptiles",
        "source-layer": "boundary",
        paint: {
          "line-color": "#94a3b8",
          "line-width": 0.6,
          "line-dasharray": [3, 2],
        },
      },
    ],
  } as const;
}

export default function MapView({
  styleUrl = process.env.NEXT_PUBLIC_OMT_STYLE_URL,
  tileUrl = process.env.NEXT_PUBLIC_OMT_TILE_URL,
  attribution = process.env.NEXT_PUBLIC_OMT_ATTR ?? DEFAULT_ATTRIBUTION,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = "w-full h-[420px] rounded-xl overflow-hidden",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: MapInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let isCancelled = false;

    const init = async () => {
      const container = containerRef.current;
      if (!container) return;

      const maplibre: MapLibreModule = await import("maplibre-gl");
      if (isCancelled || !container.isConnected) return;

      const style = styleUrl ? styleUrl : tileUrl ? createFallbackStyle(tileUrl) : null;

      if (!style) {
        console.warn(
          "MapView: neither NEXT_PUBLIC_OMT_STYLE_URL nor NEXT_PUBLIC_OMT_TILE_URL provided.",
        );
        return;
      }

      map = new maplibre.Map({
        container,
        style,
        center,
        zoom,
        attributionControl: false,
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(
        new maplibre.AttributionControl({
          compact: true,
          customAttribution: attribution,
        }),
        "bottom-right",
      );

      const scheduleResize = () => {
        if (!map) return;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (map && !isCancelled) {
            map.resize();
          }
        }, RESIZE_DEBOUNCE_MS);
      };

      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(container);

      map.once("load", () => {
        if (map && !isCancelled) {
          map.resize();
        }
      });
    };

    init().catch((error) => {
      console.error("MapView failed to initialise", error);
    });

    return () => {
      isCancelled = true;
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [attribution, center, styleUrl, tileUrl, zoom]);

  return <div ref={containerRef} className={className} data-testid="map-container" />;
}
