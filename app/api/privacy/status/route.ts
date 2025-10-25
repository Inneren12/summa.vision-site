import "server-only";

import { NextResponse } from "next/server";

import { readIdentifiers } from "@/lib/metrics/privacy";
import { loadErasureMatcher } from "@/lib/privacy/erasure";

export const runtime = "nodejs";

function coerce(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(req: Request) {
  const matcher = await loadErasureMatcher();
  const url = new URL(req.url);
  const querySid =
    coerce(url.searchParams.get("sid")) ||
    coerce(url.searchParams.get("sv_id")) ||
    coerce(url.searchParams.get("stableId")) ||
    coerce(url.searchParams.get("sessionId"));
  const queryAid =
    coerce(url.searchParams.get("aid")) ||
    coerce(url.searchParams.get("ff_aid")) ||
    coerce(url.searchParams.get("sv_aid"));
  const queryUser = coerce(url.searchParams.get("userId"));
  const identifiers = readIdentifiers(req.headers);
  const sid = querySid ?? identifiers.sid;
  const aid = queryAid ?? identifiers.aid;
  const userId = queryUser;
  const stableId = querySid;
  const erased = matcher.isErased({
    sid: sid ?? stableId ?? null,
    aid,
    userId,
    sessionId: stableId ?? sid ?? null,
  });
  return NextResponse.json({
    ok: true,
    erased,
    identifiers: {
      sid: sid ?? null,
      aid: aid ?? null,
      userId: userId ?? null,
      stableId: stableId ?? null,
    },
  });
}
