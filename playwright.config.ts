import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    // запуск standalone-сервера (Next 14 + output: 'standalone')
    command: "PORT=3000 node apps/web/.next/standalone/server.js",
    url: "http://localhost:3000",
    reuseExistingServer: false,   // сервер поднимает Playwright, не YAML
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
});
