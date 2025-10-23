import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // общий прогон e2e не трогает визуальные тесты
  testIgnore: ["visual/**"],
  webServer: {
    // Next output=standalone: запускаем сервер напрямую
    command: "PORT=3010 node apps/web/.next/standalone/server.js",
    url: "http://localhost:3010",
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
