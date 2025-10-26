import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineWorkspace } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const resolveFromWorkspace = (p: string) => path.resolve(__dirname, p);

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
    name: "viz",
    extends: "./vitest.config.ts",
    test: {
      name: "viz",
      include: ["lib/viz/**/*.test.{ts,tsx}", "tests/viz.*.spec.{ts,tsx}"],
      environment: "jsdom",
      pool: "threads",
      poolOptions: {
        threads: {
          maxThreads: 1,
          minThreads: 1,
        },
      },
      isolate: false,
      deps: {
        optimizer: {
          web: {
            exclude: ["@deck.gl/core", "echarts", "maplibre-gl", "vega-embed"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@deck.gl/core": resolveFromWorkspace("./lib/viz/stubs/deckgl-core.ts"),
        echarts: resolveFromWorkspace("./lib/viz/stubs/echarts.ts"),
        "maplibre-gl": resolveFromWorkspace("./lib/viz/stubs/maplibre-gl.ts"),
        "vega-embed": resolveFromWorkspace("./lib/viz/stubs/vega-embed.ts"),
      },
      dedupe: ["@deck.gl/core", "echarts", "maplibre-gl", "vega-embed"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "ui",
      environment: "jsdom",
      include: ["components/**/*.{spec,test}.tsx", "app/**/*.{spec,test}.tsx"],
    },
  },
]);
