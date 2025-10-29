"use client";

import { useEffect, useRef } from "react";

type MapInstance = import("maplibre-gl").Map;

function isWebGLAvailable(): boolean {
  try {
    const cv = document.createElement("canvas");
    return Boolean(cv.getContext("webgl") || cv.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export default function MapE2EPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: MapInstance | undefined;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const root = containerRef.current;
      if (!root) return;

      const markReady = () => root.setAttribute("data-e2e-ready", "1");

      if (!isWebGLAvailable()) {
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        root.appendChild(canvas);

        const fit = () => {
          const rect = root.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.max(1, Math.round(rect.width * dpr));
          canvas.height = Math.max(1, Math.round(rect.height * dpr));
        };

        fit();
        resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(root);

        markReady();
        return;
      }

      const { Map } = await import("maplibre-gl");
      const inlineStyle = { version: 8 as const, sources: {}, layers: [] };

      map = new Map({
        container: root,
        style: inlineStyle,
        attributionControl: false,
        antialias: false,
        hash: false,
        preserveDrawingBuffer: true,
      });

      const cleanup = () => {
        try {
          map?.off?.("load", onLoad);
          map?.off?.("styledata", onStyleData);
        } catch {
          // ignore cleanup failures
        }
      };

      const onLoad = () => {
        markReady();
        cleanup();
      };

      const onStyleData = () => {
        try {
          if (map?.isStyleLoaded?.()) {
            markReady();
            cleanup();
          }
        } catch {
          // ignore readiness errors
        }
      };

      map.on("load", onLoad);
      map.on("styledata", onStyleData);

      setTimeout(() => {
        if (!root.dataset.e2eReady && root.querySelector("canvas")) {
          markReady();
        }
      }, 800);
    })();

    return () => {
      try {
        map?.remove?.();
      } catch {
        // ignore teardown errors
      }

      try {
        resizeObserver?.disconnect();
      } catch {
        // ignore resize observer teardown errors
      }
    };
  }, []);

  return (
    <div
      data-testid="map-container"
      ref={containerRef}
      style={{ width: "100%", height: "70vh", minHeight: 300 }}
    />
  );
}
