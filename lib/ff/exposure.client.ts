"use client";

import type { ExposureSource } from "./exposure";

const STORAGE_PREFIX = "ff:exp:";

function makeSeenKey(flag: string, value: boolean | string | number): string {
  return `${STORAGE_PREFIX}${flag}:${String(value)}`;
}

async function postExposure(data: {
  flag: string;
  value: boolean | string | number;
  source: ExposureSource;
}) {
  await fetch("/api/ff-exposure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
    credentials: "same-origin",
  });
}

export async function trackExposureClient(params: {
  flag: string;
  value: boolean | string | number;
  source: ExposureSource;
}) {
  try {
    const key = makeSeenKey(params.flag, params.value);
    const hasStorage =
      typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
    if (hasStorage && window.sessionStorage.getItem(key)) return;
    await postExposure(params);
    if (hasStorage) {
      window.sessionStorage.setItem(key, "1");
    }
  } catch {
    // ignore network/storage failures
  }
}
