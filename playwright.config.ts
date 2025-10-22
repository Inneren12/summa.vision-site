import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "node .next/standalone/apps/web/server.js",
    cwd: "apps/web",
    port: 3000,
    env: {
      HOSTNAME: "0.0.0.0",
      PORT: "3000",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
