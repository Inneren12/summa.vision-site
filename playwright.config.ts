import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "PORT=3010 node apps/web/.next/standalone/server.js", // <-- Playwright сам стартует
    url: "http://localhost:3010",                                  // <-- новый порт
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3010",
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
