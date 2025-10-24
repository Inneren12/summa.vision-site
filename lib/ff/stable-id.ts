import "server-only";

import { cookies } from "next/headers";

export function getStableIdFromCookies(): string | undefined {
  const ck = cookies();
  return ck.get("sv_id")?.value;
}

/** Возвращает стабильный ID: при userId -> user_*, иначе cookie sv_id, иначе 'anon'. */
export function stableId(userId?: string): string {
  if (userId && userId.length > 0) return `user_${userId}`;
  return getStableIdFromCookies() ?? "anon";
}
