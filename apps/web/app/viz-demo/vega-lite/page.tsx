import Link from "next/link";
import { Suspense } from "react";

import VegaLiteDemo from "../_client/VegaLiteDemo";

export const metadata = {
  title: "Vega-Lite демо",
};

export default function VegaLiteDemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Vega-Lite</p>
        <h1 className="text-2xl font-bold">Демонстрация адаптера Vega-Lite</h1>
        <p className="text-sm text-muted-foreground">
          Эта страница использует универсальный адаптер визуализации, чтобы отобразить интерактивную
          гистограмму на Vega-Lite. Попробуйте изменить выбор категории и перерисовать окно — график
          подстроится автоматически.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/viz-demo" className="text-primary underline-offset-4 hover:underline">
            ← Вернуться к основному демо визуализаций
          </Link>
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка Vega-Lite…</p>}>
        <VegaLiteDemo />
      </Suspense>
    </main>
  );
}
