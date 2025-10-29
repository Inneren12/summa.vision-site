"use client";

import type { ReactNode } from "react";

import { DashStateProvider } from "@/lib/dash/useDashState";

interface DashLayoutProps {
  title: string;
  description?: string;
  filters?: ReactNode;
  children: ReactNode;
}

export default function DashLayout({ title, description, filters, children }: DashLayoutProps) {
  return (
    <DashStateProvider>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-neutral-600">{description}</p> : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          {filters ? (
            <aside aria-label="Фильтры" className="lg:sticky lg:top-20">
              {filters}
            </aside>
          ) : null}

          <main id="dash-main" tabIndex={-1} className="space-y-6 focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </DashStateProvider>
  );
}
