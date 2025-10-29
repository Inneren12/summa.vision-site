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

// Флаг: пропустить webServer-плагин (если стартуем сервер отдельно)
const SKIP_WEBSERVER = process.env.PW_SKIP_WEBSERVER === "1";

// ЕДИНЫЙ источник правды для webServer
const webServerConfig = {
  command: "bash -lc 'npx -y next@14.2.8 start -p ${E2E_PORT:-3000}'",
  port: PORT,
  reuseExistingServer: false,
  timeout: 180_000,
  cwd: WEB_DIR,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: HOST,
    NEXT_PUBLIC_OMT_STYLE_URL: "https://demotiles.maplibre.org/style.json",
    NEXT_PUBLIC_MAP_STYLE_URL: "https://demotiles.maplibre.org/style.json",
  },
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
