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
    environment: "jsdom",
    // Переходим на процессы — устойчивее по памяти в CI
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
        execArgv: ["--max-old-space-size=6144"],
      },
    },
    setupFiles: ["tests/setup.vitest.ts"],
    globals: true, // describe/it/vi глобально
    isolate: true,
    restoreMocks: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
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
