"use client";

import { useMemo } from "react";

import { getClientEnv } from "../env.client";

import { PublicConfigSchema, type PublicConfig } from "./schema";

const PublicDefaults: Pick<PublicConfig, "devTools"> & Partial<PublicConfig> = {
  devTools: false,
};

export function getPublicConfig(): Readonly<PublicConfig> {
  const env = getClientEnv();
  const cfg: PublicConfig = {
    appEnv: env.NEXT_PUBLIC_APP_ENV ?? "local",
    devTools: env.NEXT_PUBLIC_DEV_TOOLS
      ? env.NEXT_PUBLIC_DEV_TOOLS === "true"
      : PublicDefaults.devTools,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  };
  return Object.freeze(PublicConfigSchema.parse(cfg));
}

export function usePublicConfig(): Readonly<PublicConfig> {
  return useMemo(() => getPublicConfig(), []);
}
