module.exports = {
  ci: {
    collect: {
      // Для LHCI достаточно стабильного `next start` — standalone нам не нужен.
      startServerCommand: "npm --workspace apps/web run start -- --hostname 0.0.0.0 --port 3000",
      // Совместимый паттерн с баннером Next (✓ Ready in …) или строкой Local: http://localhost:3000
      startServerReadyPattern: "/(Local:\s+http:\/\/localhost:3000|Ready in)/i",
      startServerReadyTimeout: 120000,
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/story?slug=demo",
        "http://localhost:3000/dashboards/demo",
      ],
      numberOfRuns: 2,
      settings: {
        preset: "desktop",
        throttlingMethod: "simulate",
        // ВАЖНО: Chrome ожидает флаги строкой с пробелами, без запятых.
        chromeFlags: "--headless=new --no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "experimental-interaction-to-next-paint": ["error", { maxNumericValue: 200 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: { target: "filesystem", outputDir: "./lighthouseci" },
  },
};
