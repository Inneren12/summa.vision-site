import "server-only";

import { NextResponse } from "next/server";

import { readIdentifiers } from "@/lib/metrics/privacy";
import {
  loadErasureIndex,
  lookupErasure,
  summarizeIdentifiers,
  type PrivacyIdentifierSet,
} from "@/lib/privacy/erasure";

export const runtime = "nodejs";

function parseQueryIdentifiers(url: string): PrivacyIdentifierSet {
  try {
    const search = new URL(url);
    const userId = search.searchParams.get("userId")?.trim() || undefined;
    const sid = search.searchParams.get("sid")?.trim() || undefined;
    const aid = search.searchParams.get("aid")?.trim() || undefined;
    return { sid, aid, userId };
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const cookieIds = readIdentifiers(req.headers);
  const queryIds = parseQueryIdentifiers(req.url);
  const ids = {
    sid: cookieIds.sid ?? queryIds.sid,
    aid: cookieIds.aid ?? queryIds.aid,
    userId: queryIds.userId,
  } satisfies PrivacyIdentifierSet;

  const index = await loadErasureIndex();
  const matches = lookupErasure(index, ids);
  const erased = Boolean(matches.sid || matches.aid || matches.userId);

  const response = NextResponse.json({
    erased,
    identifiers: summarizeIdentifiers(ids),
    matches: {
      sid: matches.sid ? { at: matches.sid.at, source: matches.sid.source } : undefined,
      aid: matches.aid ? { at: matches.aid.at, source: matches.aid.source } : undefined,
      userId: matches.userId ? { at: matches.userId.at, source: matches.userId.source } : undefined,
    },
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
