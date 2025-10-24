import type { SeedBy, Seeds } from "../ports";

// murmur3 32-bit (быстрый и детерминированный)
export function murmur3_32(str: string, seed = 0): number {
  let h = seed ^ str.length;
  let i = 0;

  while (i + 4 <= str.length) {
    let k =
      (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(i + 1) & 0xff) << 8) |
      ((str.charCodeAt(i + 2) & 0xff) << 16) |
      ((str.charCodeAt(i + 3) & 0xff) << 24);

    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);

    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = Math.imul(h, 5) + 0xe6546b64;
    i += 4;
  }

  let k1 = 0;
  switch (str.length & 3) {
    case 3:
      k1 ^= (str.charCodeAt(i + 2) & 0xff) << 16;
    // fallthrough
    case 2:
      k1 ^= (str.charCodeAt(i + 1) & 0xff) << 8;
    // fallthrough
    case 1:
      k1 ^= str.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, 0xcc9e2d51);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, 0x1b873593);
      h ^= k1;
  }

  h ^= str.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  return h >>> 0;
}

export function pctHit(seed: string, pct: number) {
  const v = murmur3_32(seed) % 100;
  return v < Math.round(pct);
}

export function getSeedValue(seedBy: SeedBy | undefined, seeds: Seeds, fallback: SeedBy): string {
  const pick = seedBy ?? fallback;
  const v =
    pick === "userId"
      ? seeds.userId
      : pick === "cookie"
        ? seeds.cookie
        : pick === "ipUa"
          ? seeds.ipUa
          : pick === "anonId"
            ? seeds.anonId
            : undefined;

  return v ?? seeds.userId ?? seeds.cookie ?? seeds.anonId ?? seeds.ipUa ?? "anon";
}
