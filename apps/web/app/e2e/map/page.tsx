"use client";

import { useEffect, useRef } from "react";

import "maplibre-gl/dist/maplibre-gl.css";

type MapInstance = import("maplibre-gl").Map;

export default function MapE2EPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: MapInstance | undefined;

    (async () => {
      const { Map } = await import("maplibre-gl");

      const style =
        process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
        process.env.NEXT_PUBLIC_OMT_STYLE_URL ||
        "https://demotiles.maplibre.org/style.json";

      if (!containerRef.current) return;

      map = new Map({
        container: containerRef.current,
        style,
        attributionControl: false,
      });

      map.once("load", () => {
        containerRef.current?.setAttribute("data-e2e-ready", "1");
      });
    })();

    return () => {
      map?.remove?.();
    };
  }, []);

  return (
    <div
      data-testid="map-container"
      ref={containerRef}
      style={{
        width: "100%",
        height: "70vh",
      }}
    />
  );
}
