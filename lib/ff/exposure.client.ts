"use client";

import type { ExposureSource } from "./exposure";
import type { FlagValue } from "./runtime/types";

const STORAGE_PREFIX = "ff:exp:";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

function makeKey(flag: string, value: FlagValue): string {
  return `${STORAGE_PREFIX}${flag}:${String(value)}`;
}

function seenInSession(key: string): boolean {
  try {
    if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
      return false;
    }
    return window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markSession(key: string): void {
  try {
    if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
      return;
    }
    window.sessionStorage.setItem(key, "1");
  } catch {
    // ignore storage failures
  }
}

function seenRecently(key: string): boolean {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return false;
    }
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < TTL_MS;
  } catch {
    return false;
  }
}

function markWithTTL(key: string): void {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore storage failures
  }
}

async function postExposure(data: { flag: string; value: FlagValue; source: ExposureSource }) {
  await fetch("/api/ff-exposure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
    credentials: "same-origin",
  });
}

export async function trackExposureClient(params: {
  flag: string;
  value: FlagValue;
  source: ExposureSource;
}) {
  try {
    const key = makeKey(params.flag, params.value);
    if (seenInSession(key) || seenRecently(key)) return;
    await postExposure(params);
    markSession(key);
    markWithTTL(key);
  } catch {
    // ignore network/storage failures
  }
}
