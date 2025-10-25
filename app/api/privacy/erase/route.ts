import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { roleFromHeaders } from "@/lib/admin/rbac";
import { logAdminAction } from "@/lib/ff/audit";
import { stableCookieOptions } from "@/lib/ff/cookies";
import { FF } from "@/lib/ff/runtime";
import { correlationFromRequest } from "@/lib/metrics/correlation";
import { readIdentifiers } from "@/lib/metrics/privacy";
import {
  appendErasureRecord,
  purgeTelemetryFiles,
  summarizeIdentifiers,
  type PrivacyIdentifierSet,
} from "@/lib/privacy/erasure";

export const runtime = "nodejs";

const AdminEraseSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  sid: z.string().min(1).optional(),
  aid: z.string().min(1).optional(),
});

function setDeletionCookies(res: NextResponse) {
  const clear = stableCookieOptions({ httpOnly: false, maxAge: 0 });
  res.cookies.set("sv_id", "", clear);
  res.cookies.set("sv_aid", "", clear);
  res.cookies.set("ff_aid", "", clear);
}

function mergeIdentifiers(
  primary: PrivacyIdentifierSet,
  fallback: PrivacyIdentifierSet,
): PrivacyIdentifierSet {
  return {
    sid: primary.sid ?? fallback.sid,
    aid: primary.aid ?? fallback.aid,
    userId: primary.userId ?? fallback.userId,
  };
}

export async function POST(req: Request) {
  const role = roleFromHeaders(req.headers);
  const correlation = correlationFromRequest(req);
  const cookieIds = readIdentifiers(req.headers);

  if (role === "admin" || role === "ops") {
    const body = await req.json().catch(() => null);
    const parsed = AdminEraseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const adminIds = mergeIdentifiers(
      { userId: parsed.data.userId, sid: parsed.data.sid, aid: parsed.data.aid },
      cookieIds,
    );
    const record = await appendErasureRecord(adminIds, { source: role });
    const purge = await purgeTelemetryFiles(adminIds);
    const overridesRemoved = await FF().store.deleteOverridesByUser(parsed.data.userId);

    logAdminAction({
      timestamp: Date.now(),
      actor: role,
      action: "privacy_erase",
      identifiers: summarizeIdentifiers(adminIds),
      removedOverrides: overridesRemoved,
      purge,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      requestNamespace: correlation.namespace,
    });
    const res = NextResponse.json({
      ok: true,
      identifiers: summarizeIdentifiers(adminIds),
      erased: record
        ? { ...summarizeIdentifiers(record), at: record.at, source: record.source }
        : null,
      overridesRemoved,
      purge,
    });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const selfIds = cookieIds;
  const record = await appendErasureRecord(selfIds, { source: "self" });
  const purge = await purgeTelemetryFiles(selfIds);
  const res = NextResponse.json({
    ok: true,
    identifiers: summarizeIdentifiers(selfIds),
    erased: record
      ? { ...summarizeIdentifiers(record), at: record.at, source: record.source }
      : null,
    purge,
  });
  setDeletionCookies(res);
  res.headers.set("cache-control", "no-store");
  return res;
}
