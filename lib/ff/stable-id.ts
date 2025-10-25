import "server-only";
import crypto from "node:crypto";

import { cookies } from "next/headers";

const STABLE_ID_COOKIE = "ff_aid";

/** Утилита: взять ff_aid из header-строки cookies (для клиента / утилит). */
export function getStableIdFromCookieHeader(header?: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(/;\s*/);
  const ffAid = parts.find((p) => p.startsWith(`${STABLE_ID_COOKIE}=`));
  if (ffAid) {
    return ffAid.slice(`${STABLE_ID_COOKIE}=`.length);
  }
  return undefined;
}

/** Утилита: взять ff_aid из next/headers cookies() на сервере. */
export function getStableIdFromCookies(): string | undefined {
  const ck = cookies();
  return ck.get(STABLE_ID_COOKIE)?.value;
}

/** Сгенерировать uuid v4 для ff_aid (анонимный посетитель). */
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
 * - При валидном userId — просто валидация; stableId остаётся cookie ff_aid.
 * - Иначе → ff_aid cookie или "anon" (если cookie нет в текущем вызове).
 * Параметр strict, если true, бросит исключение при невалидном userId.
 */
export function stableId(userId?: string, opts?: { strict?: boolean }): string {
  if (userId) {
    const ok = sanitizeUserId(userId);
    if (!ok && opts?.strict) {
      throw new Error("Invalid userId format");
    }
  }
  return getStableIdFromCookies() ?? "anon";
}
