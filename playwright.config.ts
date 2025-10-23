import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "node apps/web/.next/standalone/server.js", // можно оставить, но он не запустится
    port: 3000,
    reuseExistingServer: true,  // <- ключевое: не пытаться стартовать второй раз
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
