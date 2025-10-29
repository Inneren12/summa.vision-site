import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Где лежит Next-приложение
const WEB_DIR = process.env.E2E_WEB_DIR
  ? path.resolve(process.cwd(), process.env.E2E_WEB_DIR)
  : path.resolve(__dirname, "apps/web");

// Порт/URL — всегда задаём оба
const portCandidate = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3000);
const PORT = Number.isFinite(portCandidate) && portCandidate > 0 ? portCandidate : 3000;
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const WEB_URL = `http://${HOST}:${PORT}`;

// Ищем server.js в standalone (новая и старая раскладка)
const MODERN = path.join(WEB_DIR, ".next", "standalone", "server.js");
const MONO = path.join(WEB_DIR, ".next", "standalone", "apps", "web", "server.js");
const SERVER_JS = fs.existsSync(MODERN) ? MODERN : fs.existsSync(MONO) ? MONO : null;

const BASE_ENV = {
  HOSTNAME: HOST,
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_NAME: "Summa Vision",
  NEXT_PUBLIC_API_BASE_URL: "https://example.com/api",
  NEXT_PUBLIC_SITE_URL: "https://example.com",
};

const webServerConfig = {
  command: SERVER_JS ? `node ${JSON.stringify(SERVER_JS)}` : `npx -y next@14.2.8 start -p ${PORT}`,
  port: PORT,
  url: WEB_URL,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  cwd: SERVER_JS ? path.dirname(SERVER_JS) : WEB_DIR,
  env: {
    ...process.env,
    ...BASE_ENV,
    PORT: String(PORT),
  },
} as const;

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
  // Всегда один источник правды для webServer — с явно заданными port и url
  webServer: webServerConfig,

  use: {
    baseURL: WEB_URL,
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
