/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // В ряде версий Next experimental.typedRoutes доступен; если поле убрали — просто удалите блок experimental.
  experimental: { typedRoutes: true },
  images: {
    // Замените список на ваши реальные источники, как только они определены.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
