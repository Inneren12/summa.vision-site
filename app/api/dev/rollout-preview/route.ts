import "server-only";

import { NextResponse } from "next/server";

import { FLAG_REGISTRY, isKnownFlag, type FlagName } from "@/lib/ff/flags";
import { inRollout } from "@/lib/ff/hash";
import { getFeatureFlagsFromHeaders } from "@/lib/ff/server";
import type { RolloutConfig } from "@/lib/ff/shared";
import { stableId as buildStableId } from "@/lib/ff/stable-id";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const url = new URL(req.url);
  const name = url.searchParams.get("flag") ?? "";
  const providedSid = url.searchParams.get("sid") ?? undefined;
  if (!isKnownFlag(name)) return NextResponse.json({ error: "Unknown flag" }, { status: 400 });
  const flagName = name as FlagName;
  const meta = FLAG_REGISTRY[flagName];
  if (meta.type !== "rollout")
    return NextResponse.json({ error: "Not a rollout flag" }, { status: 400 });

  const merged = await getFeatureFlagsFromHeaders(req.headers);
  const def = meta.defaultValue as RolloutConfig;
  const raw = merged[flagName];
  const cfg: RolloutConfig =
    raw && typeof raw === "object" && "enabled" in raw ? (raw as RolloutConfig) : def;

  const enabled = !!cfg.enabled;
  const percent = typeof cfg.percent === "number" ? cfg.percent : 100;
  const salt = cfg.salt ?? name;
  const sid = providedSid ?? buildStableId();
  const result = enabled ? inRollout(sid, percent, salt) : false;
  return NextResponse.json(
    { flag: name, enabled, percent, salt, stableId: sid, inRollout: result },
    { status: 200 },
  );
}
