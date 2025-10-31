import Link from "next/link";
import { Suspense } from "react";

import VizDemoClient from "./_client/VizDemoClient";

const INITIAL_SPEC = { title: "Состояние визуализации" } as const;
const INITIAL_STATE = { step: null, clicks: 0 } as const;

export default async function VizDemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Эксперимент</p>
        <h1 className="text-2xl font-bold">Демо универсального адаптера визуализации</h1>
        <p className="text-sm text-muted-foreground">
          Страница демонстрирует SSR-safe хук <code>useVizMount</code> и обработку событий
          жизненного цикла.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка визуализации…</p>}>
        <VizDemoClient initialSpec={INITIAL_SPEC} initialState={INITIAL_STATE} />
      </Suspense>
      <p className="text-xs text-muted-foreground">
        Хотите увидеть Vega-Lite в действии? Загляните в
        <Link
          href="/viz-demo/vega-lite"
          className="ml-1 text-primary underline-offset-4 hover:underline"
        >
          демо адаптера Vega-Lite
        </Link>
        .
      </p>
    </main>
  );
}
