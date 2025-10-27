export const disallowInitialModules = [
  { test: /node_modules[\\/](?:maplibre-gl)(?:[\\/]|$)/, label: "maplibre-gl", severity: "error" },
  { test: /node_modules[\\/]echarts(?:[\\/]|$)/, label: "echarts", severity: "error" },
  { test: /node_modules[\\/]@deck\.gl(?:[\\/]|$)/, label: "@deck.gl", severity: "error" },
];

export const entryBudgets = [
  {
    test: /app[\\/](?:\(visual\)[\\/])?story[\\/]page$/,
    maxInitialBytes: 600 * 1024,
    severity: "warning",
  },
  {
    test: /app[\\/]page$/,
    maxInitialBytes: 550 * 1024,
    severity: "warning",
  },
];
