module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm --workspace apps/web run start -- -p 3000",
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/story?slug=demo",
        "http://localhost:3000/dashboards/demo",
      ],
      numberOfRuns: 2,
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
      settings: {
        preset: "desktop",
        throttlingMethod: "simulate",
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
