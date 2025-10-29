import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Где лежит Next-приложение
const WEB_DIR = process.env.E2E_WEB_DIR
  ? path.resolve(process.cwd(), process.env.E2E_WEB_DIR)
  : path.resolve(__dirname, "apps/web");

// Кандидаты server.js (новая и старая раскладка standalone)
const SERVER_JS_MODERN = path.join(WEB_DIR, ".next", "standalone", "server.js");
const SERVER_JS_MONO = path.join(WEB_DIR, ".next", "standalone", "apps", "web", "server.js");
const HAS_MODERN = fs.existsSync(SERVER_JS_MODERN);
const HAS_MONO = fs.existsSync(SERVER_JS_MONO);
const SERVER_JS = HAS_MODERN ? SERVER_JS_MODERN : HAS_MONO ? SERVER_JS_MONO : null;

const DEFAULT_PORT = 3000;
const parsedPort = process.env.E2E_PORT ? Number.parseInt(process.env.E2E_PORT, 10) : DEFAULT_PORT;
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
const WEB_URL = `http://localhost:${PORT}`;
const BASE_ENV = {
  HOSTNAME: "127.0.0.1",
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_NAME: "Summa Vision",
  NEXT_PUBLIC_API_BASE_URL: "https://example.com/api",
  NEXT_PUBLIC_SITE_URL: "https://example.com",
};

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
  // Запуск тестового сервера: standalone server.js (если есть) или fallback на `next start`
  webServer: {
    command: SERVER_JS
      ? `node ${JSON.stringify(SERVER_JS)}`
      : `npx -y next@14.2.8 start -p ${PORT}`,
    port: PORT,
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Для standalone сервер читает порт из env:
    env: SERVER_JS ? { ...BASE_ENV, PORT: String(PORT) } : BASE_ENV,
    // Рабочая директория: рядом с server.js, либо корень приложения
    cwd: SERVER_JS ? path.dirname(SERVER_JS) : WEB_DIR,
  },

  use: {
    baseURL: WEB_URL,
    headless: true,
    trace: "retain-on-failure",
  },
  retries: process.env.CI ? 1 : 0,
});
