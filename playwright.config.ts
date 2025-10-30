import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

// В CI уводим браузер на системный Chrome и включаем тихий репортинг в файлы.
const PW_CHANNEL = process.env.PW_CHANNEL as "chrome" | "chromium" | "msedge" | undefined;
const PW_EXECUTABLE_PATH = process.env.PW_EXECUTABLE_PATH; // например: /usr/bin/google-chrome-stable

// Где лежит Next-приложение
const WEB_DIR = process.env.E2E_WEB_DIR
  ? path.resolve(process.cwd(), process.env.E2E_WEB_DIR)
  : path.resolve(__dirname, "apps/web");

// Playwright webServer ждёт явные port+url. Порт и hostname приходят из env, по умолчанию 3000/127.0.0.1
const PORT = Number(process.env.E2E_PORT ?? process.env.PORT ?? 3000);
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const HEALTHCHECK_URL = `${BASE_URL}/api/healthz`;

// Standalone server detection (Next 14 output: 'standalone')
const MODERN_STANDALONE = path.join(WEB_DIR, ".next", "standalone", "server.js");
const MONO_STANDALONE = path.join(WEB_DIR, ".next", "standalone", "apps", "web", "server.js");
const hasModernStandalone = fs.existsSync(MODERN_STANDALONE);
const hasMonoStandalone = fs.existsSync(MONO_STANDALONE);
const STANDALONE_SERVER = hasModernStandalone
  ? MODERN_STANDALONE
  : hasMonoStandalone
    ? MONO_STANDALONE
    : null;

// Флаги управления webServer
const SKIP_WEBSERVER = process.env.PW_SKIP_WEBSERVER === "1";
const FORCE_STANDALONE = process.env.PW_USE_STANDALONE === "1" && !!STANDALONE_SERVER;

const GPU_LAUNCH_ARGS = ["--ignore-gpu-blocklist", "--use-gl=swiftshader"] as const;

const REQUIRED_CI_ARGS = ["--headless=new", "--no-sandbox"] as const;

const withHeadlessDefaults = <
  T extends {
    headless?: boolean;
    launchOptions?: { args?: string[] };
  },
>(
  config: T,
) => {
  const launchOptions = { ...(config.launchOptions ?? {}) };

  if (CI) {
    const existingArgs = launchOptions.args ?? [];
    const mergedArgs = existingArgs.slice();
    for (const arg of REQUIRED_CI_ARGS) {
      if (!mergedArgs.includes(arg)) {
        mergedArgs.push(arg);
      }
    }
    launchOptions.args = mergedArgs;
  }

  return {
    ...config,
    headless: true as const,
    ...(Object.keys(launchOptions).length ? { launchOptions } : {}),
  };
};

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

// Если передали явный путь к Chrome — используем его, иначе канал.
const browserSelection: {
  channel?: "chrome" | "chromium" | "msedge";
  executablePath?: string;
  browserName?: "chromium";
} = { browserName: "chromium" };

if (PW_EXECUTABLE_PATH) {
  browserSelection.executablePath = PW_EXECUTABLE_PATH;
  delete browserSelection.browserName;
} else if (PW_CHANNEL) {
  browserSelection.channel = PW_CHANNEL;
  delete browserSelection.browserName;
}

// ЕДИНЫЙ источник правды для webServer
const useStandaloneServer =
  FORCE_STANDALONE || (!!STANDALONE_SERVER && !process.env.FORCE_NEXT_START);

const webServerConfig = {
  command: useStandaloneServer
    ? `node ${JSON.stringify(STANDALONE_SERVER!)}`
    : `npx -y next@14.2.8 start -p ${PORT}`,
  cwd: useStandaloneServer ? path.dirname(STANDALONE_SERVER!) : WEB_DIR,
  port: PORT,
  url: HEALTHCHECK_URL,
  reuseExistingServer: !CI,
  timeout: 120_000,
  env: {
    NEXT_E2E: process.env.NEXT_E2E ?? "1",
    NEXT_PUBLIC_MSW: process.env.NEXT_PUBLIC_MSW ?? "1",
    SV_E2E: process.env.SV_E2E ?? "1",
    SV_ALLOW_DEV_API: process.env.SV_ALLOW_DEV_API ?? "1",
    NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E ?? "1",
    NEXT_PUBLIC_DEV_TOOLS: process.env.NEXT_PUBLIC_DEV_TOOLS ?? "true",
    NEXT_PUBLIC_FLAGS_ENV: process.env.NEXT_PUBLIC_FLAGS_ENV ?? "dev",
    FF_TELEMETRY_SINK: process.env.FF_TELEMETRY_SINK ?? "memory",
    PORT: String(PORT),
    HOSTNAME: HOST,
  },
} as const;

// Отладочный вывод — видно, какой конфиг реально используется
console.log("[PW CONFIG] file:", __filename);
console.log("[PW CONFIG] web dir:", WEB_DIR);
console.log("[PW CONFIG] resolved standalone server:", STANDALONE_SERVER);
console.log("[PW CONFIG] webServer:", SKIP_WEBSERVER ? "SKIPPED" : webServerConfig);

export default defineConfig({
  testDir: "./",
  testMatch: ["e2e/**/*.spec.ts", "apps/web/e2e/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: CI ? 1 : undefined,
  expect: {
    timeout: 10_000,
  },

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
      use: withHeadlessDefaults({
        ...desktopChromeDevice,
        ...browserSelection,
        baseURL: BASE_URL,
        testIdAttribute: "data-testid",
      }),
    },
    {
      name: "mobile-chrome",
      use: withHeadlessDefaults({
        ...pixel7Device,
        ...browserSelection,
        baseURL: BASE_URL,
        testIdAttribute: "data-testid",
      }),
    },
  ],

  // Только верхний уровень управляет webServer
  webServer: SKIP_WEBSERVER ? undefined : webServerConfig,

  use: withHeadlessDefaults({
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    testIdAttribute: "data-testid",
    ...browserSelection,
  }),
});
