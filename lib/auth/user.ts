import "server-only";
import { cookies } from "next/headers";

/**
 * Возвращает userId из вашей auth-cookie (пример: "uid").
 * ВАЖНО: cookie должна быть подписана вашим auth-слоем. Здесь мы только читаем значение.
 * Разрешённый формат: a-zA-Z0-9_- длиной 1..64.
 * Если формат неверный — возвращает undefined (без исключения), чтобы не ронять прод.
 */
export function getUserIdServer(): string | undefined {
  const raw = cookies().get("uid")?.value; // ← при необходимости переименуйте под ваш auth
  if (!raw) return undefined;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(raw)) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[auth] getUserIdServer: invalid uid format");
    }
    return undefined;
  }
  return raw;
}
