/**
 * Устанавливает CSS-переменную `--vh` = 1% от текущей высоты вьюпорта.
 * Полезно для мобильных браузеров, где 100vh “прыгает”.
 * Возвращает функцию очистки.
 */
export default function installVHVar(varName: string = "--vh"): () => void {
  // На SSR ничего не делаем
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const set = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty(varName, `${vh}px`);
  };

  // инициализация и подписки
  set();
  window.addEventListener("resize", set, { passive: true });
  window.addEventListener("orientationchange", set, { passive: true });

  // очистка
  return () => {
    window.removeEventListener("resize", set);
    window.removeEventListener("orientationchange", set);
  };
}
