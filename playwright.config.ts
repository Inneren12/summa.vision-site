import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Где лежит Next-приложение
const WEB_DIR = process.env.E2E_WEB_DIR
  ? path.resolve(process.cwd(), process.env.E2E_WEB_DIR)
  : path.resolve(__dirname, "apps/web");

// Параметры сервера e2e. Playwright 1.48.0 требует, чтобы в webServer был либо port, либо url.
const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const WEB_URL = `http://${HOST}:${PORT}`;

// Ищем server.js в standalone (новая/старая раскладки)
const MODERN = path.join(WEB_DIR, ".next", "standalone", "server.js");
const MONO = path.join(WEB_DIR, ".next", "standalone", "apps", "web", "server.js");
const SERVER_JS = fs.existsSync(MODERN) ? MODERN : fs.existsSync(MONO) ? MONO : null;

// Флаг: пропустить webServer-плагин (если стартуем сервер отдельно)
const SKIP_WEBSERVER = process.env.PW_SKIP_WEBSERVER === "1";

// ЕДИНЫЙ источник правды для webServer
const webServerConfig = {
  command: SERVER_JS ? `node ${JSON.stringify(SERVER_JS)}` : `npx -y next@14.2.8 start -p ${PORT}`,
  port: PORT,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  cwd: SERVER_JS ? path.dirname(SERVER_JS) : WEB_DIR,
  env: { ...process.env, PORT: String(PORT), HOSTNAME: HOST },
} as const;

// Отладочный вывод — видно, какой конфиг реально используется
console.log(
  "[PW CONFIG] file:",
  __filename,
  "webServer:",
  SKIP_WEBSERVER ? "SKIPPED" : webServerConfig,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  // ВАЖНО: projects НЕ переопределяют webServer
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], baseURL: WEB_URL },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], baseURL: WEB_URL },
    },
  ],

  // Только верхний уровень управляет webServer
  webServer: SKIP_WEBSERVER ? undefined : webServerConfig,

  use: {
    baseURL: WEB_URL,
  },
});
