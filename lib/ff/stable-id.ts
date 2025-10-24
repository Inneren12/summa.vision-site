import "server-only";
import crypto from "node:crypto";

import { cookies } from "next/headers";

export const STABLEID_USER_PREFIX = "u:"; // исключает коллизии с анонимным sv_id

/** Утилита: взять sv_id из header-строки cookies (для клиента / утилит). */
export function getStableIdFromCookieHeader(header?: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(/;\s*/);
  const kv = parts.find((p) => p.startsWith("sv_id="));
  if (!kv) return undefined;
  return kv.slice("sv_id=".length);
}

/** Утилита: взять sv_id из next/headers cookies() на сервере. */
export function getStableIdFromCookies(): string | undefined {
  const ck = cookies();
  return ck.get("sv_id")?.value;
}

/** Сгенерировать uuid v4 для sv_id (анонимный посетитель). */
export function generateStableId(): string {
  return crypto.randomUUID();
}

/** Санитизация userId по строгому паттерну (без пробелов/PII). */
export function sanitizeUserId(userId: string): string | undefined {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) return undefined;
  return userId;
}

/**
 * Главная функция: построить стабильный идентификатор.
 * - При валидном userId → "u:<userId>" (кросс-девайс стабильность).
 * - Иначе → sv_id cookie (анонимный) или "anon" (если cookie нет в текущем вызове).
 * Параметр strict, если true, бросит исключение при невалидном userId.
 */
export function stableId(userId?: string, opts?: { strict?: boolean }): string {
  if (userId) {
    const ok = sanitizeUserId(userId);
    if (!ok) {
      if (opts?.strict) throw new Error("Invalid userId format");
      // мягкий fallback без исключения
    } else {
      return `${STABLEID_USER_PREFIX}${ok}`;
    }
  }
  return getStableIdFromCookies() ?? "anon";
}
