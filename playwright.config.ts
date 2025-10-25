import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["visual/**"],
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
  webServer: {
    command: "PORT=3010 node apps/web/.next/standalone/apps/web/server.js",
    url: "http://localhost:3010",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_NAME: "Summa Vision",
      NEXT_PUBLIC_API_BASE_URL: "https://example.com/api",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
    },
  },
  use: {
    baseURL: "http://localhost:3010",
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
