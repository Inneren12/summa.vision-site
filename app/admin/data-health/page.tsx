import { cookies, headers } from "next/headers";
import Link from "next/link";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  authorizeContext,
} from "@/lib/admin/rbac";
import { readDataHealthSummary } from "@/lib/data-health/report";

function formatTimestamp(value: unknown): string {
  if (typeof value === "number" || typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString();
    }
  }
  return "—";
}

function formatSection(value: unknown): string {
  if (value === null || typeof value === "undefined") return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function DataHealthPage() {
  const hdrs = headers();
  const context = { headers: hdrs, cookieHeader: hdrs.get("cookie") };
  const auth = authorizeContext(context, "viewer");
  if (!auth.ok) {
    throw new Error("Unauthorized");
  }
  const jar = cookies();
  jar.set(ADMIN_SESSION_COOKIE, auth.sessionValue, ADMIN_SESSION_COOKIE_OPTIONS);

  const summary = await readDataHealthSummary();
  const sections = [
    { key: "freshness", label: "Freshness", value: summary.freshness },
    { key: "ge", label: "Great Expectations", value: summary.ge },
    { key: "frictionless", label: "Frictionless", value: summary.frictionless },
    { key: "duckdb", label: "DuckDB", value: summary.duckdb },
    { key: "license", label: "License", value: summary.license },
  ];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Data Health</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            className="rounded px-3 py-1 text-neutral-700 hover:bg-neutral-200"
            href="/admin/flags"
          >
            Flags
          </Link>
          <span className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">Data Health</span>
        </nav>
        <p className="text-sm text-neutral-600">
          Latest report timestamp:{" "}
          <span className="font-semibold">{formatTimestamp(summary.ts)}</span>
        </p>
        {summary.msg && <p className="text-sm text-neutral-700">Status message: {summary.msg}</p>}
        <p className="text-sm text-neutral-700">
          Overall status: {summary.ok ? "OK" : "Attention required"}
        </p>
      </header>

      <section className="space-y-4">
        {sections.map((section) => (
          <article key={section.key} className="rounded border border-neutral-300 p-4">
            <h2 className="text-lg font-semibold">{section.label}</h2>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-neutral-50 p-3 text-sm text-neutral-800 whitespace-pre-wrap">
              {formatSection(section.value)}
            </pre>
          </article>
        ))}
      </section>
    </main>
  );
}
