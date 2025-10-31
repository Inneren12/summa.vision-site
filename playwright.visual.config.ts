import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e/visual",
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [{ name: "visual-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: undefined,
});
