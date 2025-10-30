import { appendExposure } from "@/lib/dev/exposure-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function Page() {
  await appendExposure({ gate: "identical-gates", source: "ssr-page" });

  return (
    <main className="p-6 space-y-3">
      <div data-testid="exp-a">exp-a</div>
      <div data-testid="exp-b">exp-b</div>
      <div data-testid="exp-c">exp-c</div>
    </main>
  );
}
