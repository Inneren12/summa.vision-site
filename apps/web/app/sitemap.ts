import type { MetadataRoute } from "next";

import { siteMeta } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteMeta.siteUrl;

  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/healthz`, priority: 0.1 },
  ];
}
