import { fileURLToPath } from "url";

import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "node-core",
      environment: "node",
      include: [
        "lib/**/*.test.ts",
        "lib/**/*.spec.ts",
        "security/**/*.spec.ts",
        "config*.spec.ts",
        "app/**/*.spec.ts",
        "app/**/route*.spec.ts",
      ],
      exclude: ["lib/scrolly/**", "lib/viz/**"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "scrolly",
      environment: "jsdom",
      include: [
        "lib/scrolly/**/*.test.tsx",
        "tests/scrolly.story.spec.tsx",
        "tests/story/**/*.spec.tsx",
      ],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "viz",
      environment: "jsdom",
      include: ["lib/viz/**/*.test.ts?(x)", "tests/viz.*.spec.tsx"],
    },
    resolve: {
      alias: {
        "@deck.gl/core": fileURLToPath(new URL("./lib/viz/stubs/deckgl-core.ts", import.meta.url)),
        echarts: fileURLToPath(new URL("./lib/viz/stubs/echarts.ts", import.meta.url)),
        "maplibre-gl": fileURLToPath(new URL("./lib/viz/stubs/maplibre-gl.ts", import.meta.url)),
        "vega-embed": fileURLToPath(new URL("./lib/viz/stubs/vega-embed.ts", import.meta.url)),
      },
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "ui",
      environment: "jsdom",
      include: ["components/**/*.{spec,test}.tsx", "app/**/*.{spec,test}.tsx"],
      coverage: {
        exclude: ["**/*.stories.tsx"],
      },
    },
  },
]);
