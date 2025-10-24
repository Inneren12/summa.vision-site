import "server-only";
import { cookies } from "next/headers";

/** Читаем sv_id из cookies (если есть). */
export function getStableIdFromCookies(): string | undefined {
  const ck = cookies();
  return ck.get("sv_id")?.value;
}

/** Префикс для user-based stableId. Можно переопределить через ENV для мягкой миграции. */
export const STABLEID_USER_PREFIX = process.env.FF_STABLEID_USER_PREFIX ?? "u:";

/** Генерация временного стабильного ID (без записи cookie). */
export function generateStableId(): string {
  // crypto.randomUUID доступен в Node 20; запасной вариант — time+rand
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `g:${uuid}`;
  return `g:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Санитизация userId: допускаем только a–z, A–Z, 0–9, _ и -. */
function assertValidUserId(userId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("Invalid userId format");
  }
}

/**
 * Вернуть стабильный ID для процентной раскатки:
 * - если есть userId (валидный) → `${STABLEID_USER_PREFIX}${userId}`
 * - иначе sv_id из cookie
 * - иначе сгенерированный временный ID (не PII)
 */
export function stableId(userId?: string): string {
  if (userId && userId.length > 0) {
    assertValidUserId(userId);
    return `${STABLEID_USER_PREFIX}${userId}`;
  }
  return getStableIdFromCookies() ?? generateStableId();
}
