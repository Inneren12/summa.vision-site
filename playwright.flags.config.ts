import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { buildWebServer } from "./playwright/shared/webServer";

const SKIP_WEBSERVER = process.env.PW_SKIP_WEBSERVER === "1";
const { config: BUILT_WEBSERVER, meta } = buildWebServer({
  webDir: "apps/web",
  port: Number(process.env.E2E_PORT),
  host: process.env.E2E_HOST,
});

console.log("[PW FLAGS CONFIG] file:", __filename);
console.log("[PW FLAGS CONFIG] web dir:", meta.webDir);
console.log("[PW FLAGS CONFIG] resolved standalone server:", meta.serverJs);
console.log("[PW FLAGS CONFIG] webServer:", SKIP_WEBSERVER ? "SKIPPED" : BUILT_WEBSERVER);

const config: PlaywrightTestConfig = {
  testDir: "./tests/e2e/flags",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: meta.baseUrl,
  },
  projects: [{ name: "flags-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: SKIP_WEBSERVER ? undefined : BUILT_WEBSERVER,
};

export default defineConfig(config);
