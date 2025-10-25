import path from "node:path";

import { defineConfig } from "vitest/config";

if (!process.env.COLUMNS) {
  process.env.COLUMNS = "80";
}

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: { provider: "v8" },
    setupFiles: ["tests/setup.ts"],
  },
});
