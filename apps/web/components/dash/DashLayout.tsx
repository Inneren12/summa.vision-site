"use client";
import type { ReactNode } from "react";

export default function DashLayout({
  title,
  filters,
  children,
}: {
  title: string;
  filters?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
      <aside className="col-span-12 lg:col-span-3" aria-label="Фильтры">
        {filters ?? (
          <div className="rounded-lg border p-4 text-sm text-gray-500">Панель фильтров</div>
        )}
      </aside>
      <main className="col-span-12 lg:col-span-9">
        <h1 className="text-2xl font-semibold mb-4">{title}</h1>
        {children}
      </main>
    </div>
  );
}
