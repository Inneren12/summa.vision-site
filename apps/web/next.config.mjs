/** @type {import('next').NextConfig} */
import { createRequire } from "module";
import { securityHeaders } from "./security/headers.mjs";

const require = createRequire(import.meta.url);

const isDev = process.env.NODE_ENV !== "production";
const reportOnly = process.env.CSP_REPORT_ONLY === "1";
const withSentry = Boolean(process.env.SENTRY_DSN);

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
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "d3-array": require.resolve("d3-array"),
      "d3-scale": require.resolve("d3-scale"),
    };

    return config;
  },
  async headers() {
    const headers = securityHeaders({ reportOnly, isDev, withSentry });
    return [
      { source: "/:path*", headers },
      { source: "/api/:path*", headers },
    ];
  },
};

export default nextConfig;
