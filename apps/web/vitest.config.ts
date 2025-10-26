import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // алиас под тесты: "@/..." → от корня apps/web
      "@": path.resolve(__dirname, "./"),
      // доступ к корню монорепы, если что-то импортится вверх
      "@root": path.resolve(__dirname, "../../"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.vitest.ts"],
    globals: true,          // describe/it/vi глобально
    threads: false,         // меньше OOM
    isolate: true,
    restoreMocks: true,
    coverage: { reporter: ["text", "lcov"] },
  },
});
