import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
 webServer: {
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
