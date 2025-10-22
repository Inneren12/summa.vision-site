import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      lines: 70,
      branches: 60,
      exclude: [
        "next.config.mjs",
        "postcss.config.cjs",
        "tailwind.config.ts",
        "components/**/*.stories.tsx",
        "components/index.ts",
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "app/**/error.tsx",
        "app/**/not-found.tsx",
        "app/api/**",
        "next-env.d.ts",
        "vitest.config.ts",
        "**/.next/**",
      ],
    },
  },
});
