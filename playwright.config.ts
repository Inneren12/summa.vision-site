import { defineConfig, devices } from "@playwright/test";

import { buildWebServer } from "./playwright/shared/webServer";

const CI = !!process.env.CI;

// В CI уводим браузер на системный Chrome и включаем тихий репортинг в файлы.
const PW_CHANNEL = process.env.PW_CHANNEL as "chrome" | "chromium" | "msedge" | undefined;
const PW_EXECUTABLE_PATH = process.env.PW_EXECUTABLE_PATH; // например: /usr/bin/google-chrome-stable

const SKIP_WEBSERVER = process.env.PW_SKIP_WEBSERVER === "1";
const { config: BUILT_WEBSERVER, meta: webServerMeta } = buildWebServer({
  webDir: "apps/web",
  port: Number(process.env.E2E_PORT),
  host: process.env.E2E_HOST,
});

const BASE_URL = webServerMeta.baseUrl;

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

// Отладочный вывод — видно, какой конфиг реально используется
console.log("[PW CONFIG] file:", __filename);
console.log("[PW CONFIG] web dir:", webServerMeta.webDir);
console.log("[PW CONFIG] resolved standalone server:", webServerMeta.serverJs);
console.log("[PW CONFIG] webServer:", SKIP_WEBSERVER ? "SKIPPED" : BUILT_WEBSERVER);

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
  webServer: SKIP_WEBSERVER ? undefined : BUILT_WEBSERVER,

  use: withHeadlessDefaults({
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    testIdAttribute: "data-testid",
    ...browserSelection,
  }),
});
