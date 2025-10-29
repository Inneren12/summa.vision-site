"use client";

import { useEffect, useRef } from "react";

type MapInstance = import("maplibre-gl").Map;

export default function MapE2EPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: MapInstance | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const { Map } = await import("maplibre-gl");

      const inlineStyle = { version: 8 as const, sources: {}, layers: [] };

      if (!containerRef.current) {
        return;
      }

      map = new Map({
        container: containerRef.current,
        style: inlineStyle,
        attributionControl: false,
        antialias: false,
        hash: false,
        preserveDrawingBuffer: true,
      });

      const markReady = () => containerRef.current?.setAttribute("data-e2e-ready", "1");

      const cleanupListeners = () => {
        try {
          map?.off?.("load", handleLoad);
          map?.off?.("styledata", handleStyleData);
        } catch {
          // ignore cleanup errors
        }
      };

      const handleLoad = () => {
        markReady();
        cleanupListeners();
      };

      const handleStyleData = () => {
        try {
          if (map?.isStyleLoaded?.()) {
            markReady();
            cleanupListeners();
          }
        } catch {
          // ignore style check failures
        }
      };

      map.on("load", handleLoad);
      map.on("styledata", handleStyleData);

      fallbackTimer = setTimeout(() => {
        const hasCanvas = !!containerRef.current?.querySelector("canvas");
        if (hasCanvas && !containerRef.current?.dataset.e2eReady) {
          markReady();
        }
      }, 1000);
    })();

    return () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }

      try {
        map?.remove?.();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  return (
    <div data-testid="map-container" ref={containerRef} style={{ width: "100%", height: "70vh" }} />
  );
}
