import { headers } from "next/headers";

type HealthzPayload = { ok: boolean; ts: number } | null;

async function loadHealthz(): Promise<HealthzPayload> {
  try {
    const headerList = headers();
    const protocol = headerList.get("x-forwarded-proto") ?? "http";
    const host = headerList.get("host") ?? "localhost:3000";
    const response = await fetch(`${protocol}://${host}/api/healthz`, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HealthzPayload;
  } catch {
    return null;
  }
}

export default async function Healthz() {
  const data = await loadHealthz();

  return (
    <main className="min-h-screen bg-bg text-fg p-6">
      <pre className="rounded-lg bg-primary/10 p-4 text-sm text-fg/80 shadow">
        {data ? JSON.stringify(data, null, 2) : "null"}
      </pre>
    </main>
  );
}
