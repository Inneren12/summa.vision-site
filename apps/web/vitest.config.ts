import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // "@/..." указывает в корень apps/web
      "@": path.resolve(__dirname, "./"),
      // "@root/..." — корень монорепы
      "@root": path.resolve(__dirname, "../../"),
      // мок для deck.gl
      "@deck.gl/core": path.resolve(__dirname, "tests/mocks/deck-gl-core.ts"),
      // моки для карт и графиков
      echarts: path.resolve(__dirname, "tests/mocks/echarts.ts"),
      "maplibre-gl": path.resolve(__dirname, "tests/mocks/maplibre-gl.ts"),
      // лёгкий мок для vega-embed в тестах
      "vega-embed": path.resolve(__dirname, "tests/mocks/vega-embed.ts"),
    },
  },
  test: {
    environment: "jsdom",
    // Меньше воркеров → меньше памяти в CI
    poolOptions: {
      threads: { maxThreads: 1, minThreads: 1 },
    },
    setupFiles: ["tests/setup.vitest.ts"],
    globals: true, // describe/it/vi глобально
    isolate: true,
    restoreMocks: true,
    coverage: { reporter: ["text", "lcov"] },
  },
});
