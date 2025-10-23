module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      url: ["http://localhost:3000/", "http://localhost:3000/healthz"],
      startServerCommand: "npm run web:start:ci",
      startServerReadyPattern: "Ready",
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "errors-in-console": "warn",
      },
      budgetsFile: "apps/web/lighthouse-budgets.json",
    },
    upload: { target: "filesystem", outputDir: "reports/perf" },
  },
};
