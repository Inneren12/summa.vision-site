import { definePlugin } from "@playwright/test"; // или import { defineConfig } from '@playwright/test';

export default {
  testDir: "./e2e/visual",
  // даём Playwright-у самому поднять Next в прод-режиме
  webServer: {
    command: "node .next/standalone/server.js", // без inline PORT для Windows
    cwd: "apps/web", // запускаем из каталога сборки
    env: { PORT: "3010" }, // порт задаём через env (Windows-friendly)
    url: "http://localhost:3010", // должен совпадать с PORT
    reuseExistingServer: false,
    timeout: 120000,
  },
  use: {
    baseURL: "http://localhost:3010", // чтобы можно было писать page.goto('/…')
    headless: true,
    trace: "retain-on-failure",
  },
  retries: 0,
} satisfies ReturnType<typeof definePlugin>;
