import murmur from "imurmurhash";

import type { SeedBy } from "./runtime/types";

import { getEnv } from "@/lib/env/load";

export type BucketStrategyName = "murmur3_32" | "xxhash32";

export interface BucketStrategy {
  name: BucketStrategyName;
  hashToUnit(seed: string): number;
  pctHit(seed: string, percent: number): boolean;
}

export type SeedContext = {
  stableId: string;
  userId?: string;
  namespace?: string;
  cookieId?: string;
  ip?: string;
  userAgent?: string;
};

export type SeedHints = {
  anonId?: string;
  userId?: string;
  namespace?: string;
  cookie?: string;
  ip?: string;
  userAgent?: string;
  ipUa?: string;
};

type NormalizedSeedBy = "anonId" | "userId" | "namespace" | "cookie" | "ipUa";

const MAX_UINT32 = 0xffffffff;
const DEFAULT_STRATEGY: BucketStrategyName = "murmur3_32";

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  if (percent <= 0) return 0;
  if (percent >= 100) return 100;
  return percent;
}

function normalizeSeedBy(seedBy: SeedBy | undefined): NormalizedSeedBy {
  switch (seedBy) {
    case "user":
    case "userId":
      return "userId";
    case "namespace":
      return "namespace";
    case "cookie":
      return "cookie";
    case "ipUa":
      return "ipUa";
    case "anonId":
    case "stableId":
    default:
      return "anonId";
  }
}

function resolveSeedValue(
  ctx: SeedContext,
  hints: SeedHints | undefined,
  seedBy: SeedBy | undefined,
): string {
  const normalized = normalizeSeedBy(seedBy);
  const fallback =
    hints?.anonId ?? ctx.stableId ?? hints?.userId ?? hints?.cookie ?? hints?.namespace ?? "anon";

  switch (normalized) {
    case "userId":
      return ctx.userId ?? hints?.userId ?? fallback;
    case "namespace":
      return ctx.namespace ?? hints?.namespace ?? fallback;
    case "cookie":
      return ctx.cookieId ?? hints?.cookie ?? fallback;
    case "ipUa": {
      if (hints?.ipUa) return hints.ipUa;
      const ip = hints?.ip ?? ctx.ip ?? "0.0.0.0";
      const ua = hints?.userAgent ?? ctx.userAgent ?? "unknown";
      return `${ip}::${ua}`;
    }
    case "anonId":
    default:
      return hints?.anonId ?? ctx.stableId ?? fallback;
  }
}

function rotl32(value: number, count: number): number {
  return ((value << count) | (value >>> (32 - count))) >>> 0;
}

function readUint32LE(buffer: Buffer, offset: number): number {
  return (
    (buffer[offset]! |
      (buffer[offset + 1]! << 8) |
      (buffer[offset + 2]! << 16) |
      (buffer[offset + 3]! << 24)) >>>
    0
  );
}

function xxhash32(input: string, seed = 0): number {
  const data = Buffer.from(input, "utf8");
  const length = data.length;
  let index = 0;
  let hash = 0;

  const PRIME32_1 = 0x9e3779b1;
  const PRIME32_2 = 0x85ebca77;
  const PRIME32_3 = 0xc2b2ae3d;
  const PRIME32_4 = 0x27d4eb2f;
  const PRIME32_5 = 0x165667b1;

  if (length >= 16) {
    let v1 = (seed + PRIME32_1 + PRIME32_2) >>> 0;
    let v2 = (seed + PRIME32_2) >>> 0;
    let v3 = seed >>> 0;
    let v4 = (seed - PRIME32_1) >>> 0;
    const limit = length - 16;

    while (index <= limit) {
      v1 = Math.imul(v1 + readUint32LE(data, index), PRIME32_2);
      v1 = rotl32(v1, 13);
      v1 = Math.imul(v1, PRIME32_1) >>> 0;
      index += 4;

      v2 = Math.imul(v2 + readUint32LE(data, index), PRIME32_2);
      v2 = rotl32(v2, 13);
      v2 = Math.imul(v2, PRIME32_1) >>> 0;
      index += 4;

      v3 = Math.imul(v3 + readUint32LE(data, index), PRIME32_2);
      v3 = rotl32(v3, 13);
      v3 = Math.imul(v3, PRIME32_1) >>> 0;
      index += 4;

      v4 = Math.imul(v4 + readUint32LE(data, index), PRIME32_2);
      v4 = rotl32(v4, 13);
      v4 = Math.imul(v4, PRIME32_1) >>> 0;
      index += 4;
    }

    hash = (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) >>> 0;
  } else {
    hash = (seed + PRIME32_5) >>> 0;
  }

  hash = (hash + length) >>> 0;

  while (index <= length - 4) {
    const k1 = Math.imul(readUint32LE(data, index), PRIME32_3) >>> 0;
    hash = Math.imul(rotl32(hash + k1, 17), PRIME32_4) >>> 0;
    index += 4;
  }

  while (index < length) {
    hash =
      Math.imul(rotl32((hash + Math.imul(data[index]!, PRIME32_5)) >>> 0, 11), PRIME32_1) >>> 0;
    index += 1;
  }

  hash ^= hash >>> 15;
  hash = Math.imul(hash, PRIME32_2) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, PRIME32_3) >>> 0;
  hash ^= hash >>> 16;

  return hash >>> 0;
}

function createMurmurStrategy(): BucketStrategy {
  return {
    name: "murmur3_32",
    hashToUnit(seed: string) {
      const hash = murmur(seed).result() >>> 0;
      return hash / MAX_UINT32;
    },
    pctHit(seed: string, percent: number) {
      const unit = this.hashToUnit(seed);
      return unit * 100 < clampPercent(percent);
    },
  } satisfies BucketStrategy;
}

function createXxhashStrategy(): BucketStrategy {
  return {
    name: "xxhash32",
    hashToUnit(seed: string) {
      const hash = xxhash32(seed) >>> 0;
      return hash / MAX_UINT32;
    },
    pctHit(seed: string, percent: number) {
      const unit = this.hashToUnit(seed);
      return unit * 100 < clampPercent(percent);
    },
  } satisfies BucketStrategy;
}

const STRATEGIES = new Map<BucketStrategyName, BucketStrategy>([
  ["murmur3_32", createMurmurStrategy()],
  ["xxhash32", createXxhashStrategy()],
]);

let activeStrategy: BucketStrategy | null = null;

function resolveConfiguredStrategy(): BucketStrategy {
  const env = getEnv();
  const requested = env.FF_BUCKET_STRATEGY?.toLowerCase() as BucketStrategyName | undefined;
  if (requested && STRATEGIES.has(requested)) {
    return STRATEGIES.get(requested)!;
  }
  if (requested && !STRATEGIES.has(requested)) {
    console.warn(
      `[ff.bucketing] Unknown bucket strategy "${env.FF_BUCKET_STRATEGY}". Falling back to ${DEFAULT_STRATEGY}.`,
    );
  }
  return STRATEGIES.get(DEFAULT_STRATEGY)!;
}

export function getBucketStrategy(): BucketStrategy {
  if (!activeStrategy) {
    activeStrategy = resolveConfiguredStrategy();
  }
  return activeStrategy;
}

export function hashToUnit(seed: string): number {
  return getBucketStrategy().hashToUnit(seed);
}

export function pctHit(seed: string, percent: number): boolean {
  return getBucketStrategy().pctHit(seed, percent);
}

export function percentFor(seed: string): number {
  return hashToUnit(seed) * 100;
}

export function seedFor(
  _flag: string,
  ns: SeedContext,
  seeds: SeedHints | undefined,
  seedBy: SeedBy | undefined,
): string {
  return resolveSeedValue(ns, seeds, seedBy);
}

export function __resetBucketStrategyCache(): void {
  activeStrategy = null;
}
