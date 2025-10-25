import { notFound } from "next/navigation";

import { getEnv } from "@/lib/env/load";
import { validateFeatureFlagsEnvString } from "@/lib/ff/schema";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    notFound();
  }
  const r = validateFeatureFlagsEnvString(process.env.FEATURE_FLAGS_JSON);
  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>FEATURE_FLAGS_JSON — Schema Report</h1>
      <p>
        Status:{" "}
        <strong style={{ color: r.ok ? "var(--color-status-ok)" : "var(--color-status-alert)" }}>
          {r.ok ? "OK" : "HAS ISSUES"}
        </strong>
      </p>
      <section>
        <h2>Errors ({r.errors.length})</h2>
        {r.errors.length === 0 ? (
          <p>—</p>
        ) : (
          <ul>
            {r.errors.map((e, i) => (
              <li key={i}>
                <code>{e}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Warnings ({r.warnings.length})</h2>
        {r.warnings.length === 0 ? (
          <p>—</p>
        ) : (
          <ul>
            {r.warnings.map((w, i) => (
              <li key={i}>
                <code>{w}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p style={{ opacity: 0.7, marginTop: 16 }}>
        This page does not print ENV content to avoid leaking secrets. It only lists issues by key.
      </p>
    </main>
  );
}
