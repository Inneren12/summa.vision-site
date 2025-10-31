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

export default function ClientPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      if (!isWebGLAvailable()) {
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.setAttribute("data-testid", "fallback-canvas");
        root.appendChild(canvas);

        cleanup = () => {
          if (canvas.parentNode === root) {
            root.removeChild(canvas); // FIX: no-empty
          }
        };
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

        const onLoad = () => {
          if (root.querySelector("canvas")) root.setAttribute("data-e2e-ready", "1");
        };
        map.on("load", onLoad);

        // запасной триггер «готовности»
        setTimeout(() => {
          if (!root.dataset.e2eReady && root.querySelector("canvas")) {
            root.setAttribute("data-e2e-ready", "1");
          }
        }, 800);

        cleanup = () => {
          try { map.off("load", onLoad); } catch (e) { void e; }
          try { map.remove(); } catch (e) { void e; }
        };
      } catch {
        // Если maplibre не подтянулся — остаёмся без карты
        const div = document.createElement("div");
        div.textContent = "Map unavailable";
        root.appendChild(div);

        cleanup = () => {
          if (div.parentNode === root) {
            root.removeChild(div); // FIX: no-empty
          }
        };
      }
    })();

    return () => {
      try {
        cleanup?.();
      } catch (e) {
        void e; // FIX: no-empty
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
