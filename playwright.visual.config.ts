import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/visual",
  webServer: {
    // Используем standalone билд Next.js на 3010, чтобы не конфликтовать с 3000
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
