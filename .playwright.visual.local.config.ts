/**
 * Local-only Playwright config for updating visual baselines.
 * Not used in CI – start the Next.js server manually before running tests.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e/visual",
  use: {
    baseURL: BASE_URL,
    screenshot: "on",
    trace: "retain-on-failure",
  },
  projects: [{ name: "visual-local", use: { ...devices["Desktop Chrome"] } }],
  webServer: undefined,
});
