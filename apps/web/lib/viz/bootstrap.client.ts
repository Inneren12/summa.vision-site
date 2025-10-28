"use client";

export async function init() {
  // Важно: не импортируйте здесь напрямую maplibre/echarts/deck.gl.
  // Если нужно «зарегистрировать» адаптеры — делайте это через ленивую карту.
  await import("./lazyAdapters.client");
  // Дополнительная инициализация (без обращения к тяжёлым либам) — ок.
}
