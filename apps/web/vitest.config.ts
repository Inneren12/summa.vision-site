import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  esbuild: { sourcemap: false },
  plugins: [react()],
  resolve: {
    alias: [
      // "@/..." указывает в корень apps/web
      { find: "@", replacement: r("./") },
      // "@root/..." — корень монорепы
      { find: "@root", replacement: path.resolve(__dirname, "../../") },
      // Жёстко подменяем тяжёлые визуальные зависимости на стабы
      { find: /^@deck\.gl\/mapbox(?:\/.*)?$/, replacement: r("lib/viz/stubs/deckgl-mapbox.ts") },
      { find: /^@deck\.gl\/.*$/, replacement: r("lib/viz/stubs/deckgl-core.ts") },
      { find: /^echarts(?:\/.*)?$/, replacement: r("lib/viz/stubs/echarts.ts") },
      { find: /^maplibre-gl(?:\/.*)?$/, replacement: r("lib/viz/stubs/maplibre-gl.ts") },
      { find: /^vega-embed(?:\/.*)?$/, replacement: r("lib/viz/stubs/vega-embed.ts") },
      { find: /^vega(?:\/.*)?$/, replacement: r("lib/viz/stubs/vega.ts") },
      { find: /^vega-lite(?:\/.*)?$/, replacement: r("lib/viz/stubs/vega-lite.ts") },
      { find: /^zrender(?:\/.*)?$/, replacement: r("lib/viz/stubs/zrender.ts") },
    ],
  },
  optimizeDeps: {
    exclude: [
      "@deck.gl/core",
      "@deck.gl/mapbox",
      "@deck.gl/layers",
      "@deck.gl/react",
      "echarts",
      "maplibre-gl",
      "vega",
      "vega-lite",
      "vega-embed",
      "zrender",
    ],
  },
  test: {
    // По умолчанию Node; jsdom подключаем только там, где он нужен
    environment: "node",
    environmentMatchGlobs: [
      ["**/*.spec.tsx", "jsdom"],
      ["**/*.test.tsx", "jsdom"],
      ["components/**/*.{spec,test}.tsx", "jsdom"],
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

    setupFiles: ["./test/msw/server.ts", "./vitest.setup.ts", "tests/setup.vitest.ts"],
    globals: true, // describe/it/vi глобально
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    server: {
      deps: {
        external: [
          /^@deck\.gl\/.*/,
          /^echarts(?:\/.*)?$/,
          /^maplibre-gl(?:\/.*)?$/,
          /^vega-embed(?:\/.*)?$/,
          /^vega(?:-lite)?(?:\/.*)?$/,
          /^zrender(?:\/.*)?$/,
        ],
      },
    },

    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      cleanOnRerun: false,
      all: false,
      // Инструментируем только библиотечный код — меньше накладных расходов.
      include: ["lib/**"],
      exclude: [
        "**/*.stories.tsx",
        "lib/viz/**",
        "lib/viz/stubs/**",
        "scripts/**",
        "app/(visual)/**",
        "components/**",
        "app/**",
        "lib/stories/aggregations.ts",
      ],
    },
  },
});
