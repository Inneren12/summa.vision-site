"use client";

import { useEffect, useRef } from "react";

type MapInstance = import("maplibre-gl").Map;

function isWebGLAvailable(): boolean {
  try {
    const cv = document.createElement("canvas");
    return Boolean(cv.getContext("webgl") || cv.getContext("experimental-webgl"));
  } catch (error) {
    console.warn("WebGL capability check failed", error);
    return false;
  }
}

export default function MapE2EPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let resizeObserver: ResizeObserver | null = null;
    let cleanupMap: (() => void) | null = null;

    const markReady = () => root.setAttribute("data-e2e-ready", "1");

    const setupFallbackCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.setAttribute("data-testid", "fallback-canvas");
      root.appendChild(canvas);

      const sync = () => {
        const rect = root.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
      };

      sync();
      resizeObserver = new ResizeObserver(sync);
      resizeObserver.observe(root);
      window.addEventListener("resize", sync);

      requestAnimationFrame(markReady);

      cleanupMap = () => {
        try {
          resizeObserver?.disconnect();
        } catch (error) {
          console.warn("Failed to disconnect ResizeObserver", error);
        }
        window.removeEventListener("resize", sync);
        try {
          root.removeChild(canvas);
        } catch (error) {
          console.warn("Failed to remove fallback canvas", error);
        }
      };
    };

    (async () => {
      if (!isWebGLAvailable()) {
        setupFallbackCanvas();
        return;
      }

      try {
        const { Map } = await import("maplibre-gl");
        const inlineStyle = { version: 8 as const, sources: {}, layers: [] };

        const map: MapInstance = new Map({
          container: root,
          style: inlineStyle,
          attributionControl: false,
          antialias: false,
          hash: false,
          preserveDrawingBuffer: true,
        });

        const tryReady = () => {
          if (root.querySelector("canvas")) {
            markReady();
          }
        };

        const onLoad = () => {
          tryReady();
          map.off("styledata", onStyleData);
        };

        const onStyleData = () => {
          if (map.isStyleLoaded()) {
            tryReady();
            map.off("styledata", onStyleData);
          }
        };

        map.on("load", onLoad);
        map.on("styledata", onStyleData);

        setTimeout(() => {
          if (!root.dataset.e2eReady && root.querySelector("canvas")) {
            markReady();
          }
        }, 800);

        cleanupMap = () => {
          map.off("load", onLoad);
          map.off("styledata", onStyleData);
          map.remove();
        };
      } catch (error) {
        console.warn("MapLibre unavailable in E2E, using fallback canvas:", error);
        setupFallbackCanvas();
      }
    })();

    return () => {
      try {
        cleanupMap?.();
      } catch (error) {
        console.warn("Failed to clean up MapLibre", error);
      }
      try {
        resizeObserver?.disconnect();
      } catch (error) {
        console.warn("Failed to disconnect ResizeObserver", error);
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
