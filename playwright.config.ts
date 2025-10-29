import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// В CI уводим браузер на системный Chrome и включаем тихий репортинг в файлы.
const PW_CHANNEL = process.env.PW_CHANNEL as "chrome" | "chromium" | "msedge" | undefined;

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

const GPU_LAUNCH_ARGS = ["--ignore-gpu-blocklist", "--use-gl=swiftshader"] as const;

const withWebGLLaunchArgs = <T extends { launchOptions?: { args?: string[] } }>(device: T): T => {
  const existingArgs = device.launchOptions?.args ?? [];
  const mergedArgs = existingArgs.slice();
  for (const arg of GPU_LAUNCH_ARGS) {
    if (!mergedArgs.includes(arg)) {
      mergedArgs.push(arg);
    }
  }

  return {
    ...device,
    launchOptions: {
      ...device.launchOptions,
      args: mergedArgs,
    },
  };
};

const desktopChromeDevice = withWebGLLaunchArgs(devices["Desktop Chrome"]);
const pixel7Device = withWebGLLaunchArgs(devices["Pixel 7"]);

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
  testDir: "./",
  testMatch: ["e2e/**/*.spec.ts", "apps/web/e2e/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Куда складывать артефакты (репорты, логи, трэйсы)
  outputDir: "test-results",

  // Минимум шума в консоль + файлы для анализа и ошибок.
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/e2e.json" }],
    ["./tools/playwright/errors-only-reporter.js", { outputFile: "test-results/errors.log" }],
  ],

  // ВАЖНО: projects НЕ переопределяют webServer
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...desktopChromeDevice,
        ...(PW_CHANNEL ? { channel: PW_CHANNEL } : {}),
        baseURL: WEB_URL,
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...pixel7Device,
        ...(PW_CHANNEL ? { channel: PW_CHANNEL } : {}),
        baseURL: WEB_URL,
      },
    },
  ],

  // Только верхний уровень управляет webServer
  webServer: SKIP_WEBSERVER ? undefined : webServerConfig,

  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    ...(PW_CHANNEL ? { channel: PW_CHANNEL } : {}),
  },
});
