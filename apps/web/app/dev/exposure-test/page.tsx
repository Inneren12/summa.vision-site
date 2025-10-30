import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function logOneExposureOnServer() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;

  try {
    await fetch(`${base}/api/dev/flags-events?emit=dedup-gate&etype=exposure&source=ssr`, {
      cache: "no-store",
    });
  } catch {
    // ignore network errors; tests only need best-effort logging
  }
}

export default async function ExposureTestPage() {
  await logOneExposureOnServer();

  return (
    <main className="p-6 space-y-3">
      <div data-testid="exp-a">exp-a</div>
      <div data-testid="exp-b">exp-b</div>
      <div data-testid="exp-c">exp-c</div>
    </main>
  );
}
