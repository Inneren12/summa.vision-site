import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: { sourcemap: false },
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
    // По умолчанию Node; jsdom подключаем только для React-рендеров
    environment: "node",
    environmentMatchGlobs: [
      ["**/*.spec.tsx", "jsdom"],
      ["**/*.test.tsx", "jsdom"],
      ["app/**", "jsdom"],
      ["components/**", "jsdom"],
      ["tests/telemetry/**", "jsdom"],
    ],
    sequence: { concurrent: false, shuffle: false },

    // Процессы вместо worker'ов + увеличенный heap и принудительный GC
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
        execArgv: ["--max-old-space-size=8192", "--expose-gc"],
      },
    },

    setupFiles: ["tests/setup.vitest.ts"],
    globals: true, // describe/it/vi глобально
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      cleanOnRerun: false,
      all: false,
      include: ["components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.stories.*",
        "lib/viz/stubs/**",
        "lib/viz/bootstrap.client.ts",
        "lib/stories/**",
        "scripts/**",
        "next.config.mjs",
        "postcss.config.cjs",
        "tailwind.config.ts",
        "vitest.setup.ts",
        "coverage/**",
        "node_modules/**",
      ],
    },
  },
});
