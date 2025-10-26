import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.vitest.ts"],
    threads: false,          // меньше памяти и «вылетов воркеров»
    isolate: true,
    passWithNoTests: false,
  },
});
