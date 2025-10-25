import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getEnv } from "@/lib/env/load";
import { getFlagsServer } from "@/lib/ff/effective.server";
import { knownFlags, FLAG_REGISTRY } from "@/lib/ff/flags";
import { stableId } from "@/lib/ff/stable-id";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    notFound();
  }
  const DevFlagsClient = (await import("@/components/dev/DevFlagsClient")).default; // ленивый импорт — не попадёт в прод‑бандлы
  const serverFlags = await getFlagsServer();
  const ck = cookies();
  const overridesJson = ck.get("sv_flags_override")?.value;
  const reg = knownFlags().map((name) => {
    const meta = FLAG_REGISTRY[name];
    return {
      name,
      type: meta.type,
      description: meta.description,
      deprecated: Boolean(meta.deprecated),
      ignoreOverrides: Boolean(meta.ignoreOverrides),
      variants:
        meta.type === "variant"
          ? Object.keys(
              (meta.defaultValue as { variants?: Record<string, number> })?.variants ?? {},
            )
          : undefined,
    };
  });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const sid = stableId();
  return (
    <main style={{ padding: 16 }}>
      <h1>Dev Flags</h1>
      <DevFlagsClient
        baseUrl={baseUrl}
        registry={reg}
        serverFlags={serverFlags as Record<string, boolean | string | number>}
        overridesJson={overridesJson}
        stableId={sid}
      />
    </main>
  );
}
