import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/visual",
  webServer: {
    command: "npm --workspace apps/web run start",

    env: { PORT: "3010" },
    url: "http://localhost:3010",
    reuseExistingServer: false,
    timeout: 120000,
  },
  use: {
    baseURL: "http://localhost:3010",
    headless: true,
    trace: "retain-on-failure",
  },
  retries: 0,
});
