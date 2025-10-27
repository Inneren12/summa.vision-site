/** @type {import('next').NextConfig} */
import bundleAnalyzer from "@next/bundle-analyzer";
import { disallowInitialModules, entryBudgets } from "./config/viz-bundle-rules.mjs";
import { VizBundleBudgetPlugin } from "./lib/webpack/VizBundleBudgetPlugin.mjs";
import { createRequire } from "node:module";
import { securityHeaders } from "./security/headers.mjs";

const require = createRequire(import.meta.url);

const isDev = process.env.NODE_ENV !== "production";
const reportOnly = process.env.CSP_REPORT_ONLY === "1";
const withSentry = Boolean(process.env.SENTRY_DSN);

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true" || process.env.NEXT_VIZ_ANALYZE === "1",
});

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: { externalDir: true, typedRoutes: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const headers = securityHeaders({ reportOnly, isDev, withSentry });
    return [
      { source: "/:path*", headers },
      { source: "/api/:path*", headers },
    ];
  },
  webpack(config) {
    config.plugins = config.plugins ?? [];
    if (process.env.NEXT_DISABLE_VIZ_BUDGETS !== "1") {
      config.plugins.push(
        new VizBundleBudgetPlugin({
          disallowInitial: disallowInitialModules,
          entryBudgets,
        }),
      );
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      "d3-array": require.resolve("d3-array"),
      "d3-scale": require.resolve("d3-scale"),
    };

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
