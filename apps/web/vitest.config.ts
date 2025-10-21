import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      lines: 70,
      branches: 60,
      exclude: [
        "next.config.mjs",
        "postcss.config.cjs",
        "tailwind.config.ts",
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
