module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand: "npm run web:start",
      url: ["http://localhost:3000/", "http://localhost:3000/healthz"],
      settings: { budgetsPath: "apps/web/lighthouse-budgets.json" },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
