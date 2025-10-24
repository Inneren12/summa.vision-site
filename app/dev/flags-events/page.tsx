import { notFound } from "next/navigation";

import { snapshot } from "@/lib/ff/metrics";
import { readRecent } from "@/lib/ff/telemetry";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") {
    notFound();
  }
  const filterFlag = typeof searchParams?.flag === "string" ? searchParams.flag : undefined;
  const events = readRecent(200, filterFlag ? { flag: filterFlag } : undefined);
  const counters = snapshot();
  return (
    <main style={{ padding: 16 }}>
      <h1>Flag Evaluations (recent)</h1>
      <section
        style={{
          margin: "8px 0",
          padding: 8,
          background: "var(--color-bg-subtle)",
          color: "var(--color-fg-default)",
        }}
      >
        <strong>Stats:</strong> <code>429={counters["override.429"]}</code>
        {" | "}
        <code>403.test={counters["override.403"]}</code>
        {" | "}
        <code>403.xsite={counters["override.403.crossSite"]}</code>
        {" | "}
        <code>400.unknown={counters["override.400.unknown"]}</code>
        {" | "}
        <code>400.type={counters["override.400.type"]}</code>
      </section>
      <form method="get" style={{ marginBottom: 12 }}>
        <label>
          Filter by flag:{" "}
          <input type="text" name="flag" defaultValue={filterFlag ?? ""} placeholder="flagName" />
        </label>
        <button type="submit" style={{ marginLeft: 8 }}>
          Apply
        </button>
      </form>
      <table style={{ fontFamily: "monospace", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 4 }}>ts</th>
            <th style={{ textAlign: "left", padding: 4 }}>flag</th>
            <th style={{ textAlign: "left", padding: 4 }}>value</th>
            <th style={{ textAlign: "left", padding: 4 }}>source</th>
            <th style={{ textAlign: "left", padding: 4 }}>stableId</th>
            <th style={{ textAlign: "left", padding: 4 }}>userId</th>
            <th style={{ textAlign: "left", padding: 4 }}>eval(ms)</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td style={{ padding: 4 }}>{new Date(e.ts).toISOString().slice(11, 19)}</td>
              <td style={{ padding: 4 }}>{e.flag}</td>
              <td style={{ padding: 4 }}>{String(e.value)}</td>
              <td style={{ padding: 4 }}>{e.source}</td>
              <td
                style={{ padding: 4, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {e.stableId}
              </td>
              <td style={{ padding: 4 }}>{e.userId ?? ""}</td>
              <td style={{ padding: 4 }}>{e.evaluationTime ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
