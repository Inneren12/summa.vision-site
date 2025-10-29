/** @type {import('next').NextConfig} */
import { createRequire } from "node:module";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextPWA from "next-pwa";
import { RangeRequestsPlugin } from "workbox-range-requests";

import { securityHeaders } from "./security/headers.mjs";
import { RareVizBudgetPlugin } from "./lib/webpack/rareVizBudgetPlugin.mjs";

const require = createRequire(import.meta.url);

const isDev = process.env.NODE_ENV !== "production";
const reportOnly = process.env.CSP_REPORT_ONLY === "1";
const withSentry = Boolean(process.env.SENTRY_DSN);
// E2E: allow disabling the service worker so Playwright doesn't fight cached responses.
const disablePWA = isDev || process.env.E2E === "1" || process.env.DISABLE_PWA === "1";
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true" || process.env.NEXT_VIZ_ANALYZE === "1",
});

const OFFLINE_PAGE = "/offline";
const HERO_IMAGE_WARM_URL = "/brand/summa-vision-mark.png";
const STORY_DATA_WARM_URLS = ["/api/stories"];

const GOOGLE_FONTS_CACHE = {
  urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
  handler: "CacheFirst",
  options: {
    cacheName: "google-fonts",
    expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 365 },
    cacheableResponse: { statuses: [0, 200] },
  },
};

const ADDITIONAL_PRECACHE = [
  { url: HERO_IMAGE_WARM_URL, revision: null },
  ...STORY_DATA_WARM_URLS.map((url) => ({ url, revision: null })),
];

const ADDITIONAL_MANIFEST_ENTRIES = [...ADDITIONAL_PRECACHE];

const runtimeCaching = [
  {
    urlPattern: ({ request }) => request.destination === "document",
    handler: "NetworkFirst",
    options: {
      cacheName: "pages",
      networkTimeoutSeconds: 10,
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 3 },
    },
  },
  {
    urlPattern: ({ request }) =>
      request.destination === "style" ||
      request.destination === "script" ||
      request.destination === "worker",
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "static-assets",
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
  GOOGLE_FONTS_CACHE,
  {
    urlPattern: ({ request }) => request.destination === "image",
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "image-assets",
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
  {
    urlPattern: ({ url }) =>
      url.pathname.startsWith("/api/stories") || url.pathname.startsWith("/api/story"),
    handler: "NetworkFirst",
    method: "GET",
    options: {
      cacheName: "story-api",
      networkTimeoutSeconds: 10,
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 12 },
    },
  },
  {
    urlPattern: ({ url, request }) =>
      request.destination === "json" ||
      url.pathname.startsWith("/data/") ||
      url.pathname.endsWith(".json"),
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "datasets",
      cacheableResponse: { statuses: [200] },
      expiration: { maxEntries: 48, maxAgeSeconds: 60 * 60 * 24 * 14 },
    },
  },
  {
    urlPattern: ({ url }) =>
      /(?:tiles|tile|basemap|mapbox|cartocdn|arcgis|maptiler)/i.test(url.hostname),
    handler: "CacheFirst",
    options: {
      cacheName: "map-tiles",
      cacheableResponse: { statuses: [0, 200] },
      expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
      plugins: [new RangeRequestsPlugin()],
    },
  },
];

const withPWA = createNextPWA({
  cacheOnFrontEndNav: true,
  dest: "public",
  disable: disablePWA,
  fallbacks: {
    document: OFFLINE_PAGE,
  },
  register: true,
  scope: "/",
  skipWaiting: true,
  clientsClaim: true,
  additionalManifestEntries: ADDITIONAL_MANIFEST_ENTRIES,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  navigationPreload: true,
  runtimeCaching,
});

const isE2E =
  Boolean(process.env.PLAYWRIGHT_TEST_BASE_URL ?? process.env.E2E_PORT) ||
  process.env.E2E === "1" ||
  process.env.DISABLE_PWA === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(isE2E ? {} : { output: "standalone" }),
  experimental: {
    externalDir: true,
    typedRoutes: true,
  },
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
    config.resolve.alias = {
      ...config.resolve.alias,
      "d3-array": require.resolve("d3-array"),
      "d3-scale": require.resolve("d3-scale"),
    };

    if (process.env.NEXT_VIZ_ENFORCE_BUDGETS !== "0") {
      config.plugins = config.plugins || [];
      config.plugins.push(new RareVizBudgetPlugin());
    }

    return config;
  },
};

export default withBundleAnalyzer(withPWA(nextConfig));
