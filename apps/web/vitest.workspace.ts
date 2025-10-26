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
      pool: "forks",
      maxWorkers: 1,
      isolate: false,
      poolOptions: {
        forks: {
          minForks: 1,
          maxForks: 1,
          execArgv: ["--max-old-space-size=8192", "--expose-gc"],
        },
      },
      deps: {
        external: [
          /^@deck\.gl\/.*/,
          /^echarts(?:\/.*)?$/,
          /^maplibre-gl(?:\/.*)?$/,
          /^vega-embed(?:\/.*)?$/,
          /^vega(?:-lite)?(?:\/.*)?$/,
        ],
      },
      coverage: { enabled: false },
    },
    resolve: {
      alias: [
        {
          find: /^@deck\.gl\/.*$/,
          replacement: resolveFromWorkspace("./lib/viz/stubs/deckgl-core.ts"),
        },
        {
          find: /^echarts(?:\/.*)?$/,
          replacement: resolveFromWorkspace("./lib/viz/stubs/echarts.ts"),
        },
        {
          find: /^maplibre-gl(?:\/.*)?$/,
          replacement: resolveFromWorkspace("./lib/viz/stubs/maplibre-gl.ts"),
        },
        {
          find: /^vega-embed(?:\/.*)?$/,
          replacement: resolveFromWorkspace("./lib/viz/stubs/vega-embed.ts"),
        },
        {
          find: /^vega(?:\/.*)?$/,
          replacement: resolveFromWorkspace("./lib/viz/stubs/vega.ts"),
        },
        {
          find: /^vega-lite(?:\/.*)?$/,
          replacement: resolveFromWorkspace("./lib/viz/stubs/vega-lite.ts"),
        },
      ],
      dedupe: ["@deck.gl/core", "echarts", "maplibre-gl", "vega-embed", "vega", "vega-lite"],
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
