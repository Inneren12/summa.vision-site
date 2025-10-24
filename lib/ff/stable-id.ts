import "server-only";
import { cookies } from "next/headers";

/** Прочитать sv_id из cookies (если есть). */
export function getStableIdFromCookies(): string | undefined {
  const ck = cookies();
  return ck.get("sv_id")?.value;
}

/**
 * Вернуть стабильный ID для процентной раскатки:
 * - если есть userId → "user_<id>" (кросс‑девайс консистентность)
 * - иначе sv_id из cookie
 * - иначе "anon"
 */
export function stableId(userId?: string): string {
  if (userId && userId.length > 0) return `user_${userId}`;
  return getStableIdFromCookies() ?? "anon";
}
