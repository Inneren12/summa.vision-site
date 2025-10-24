import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isKnownFlag, knownFlags } from "../../../lib/ff/flags";
import { inc } from "../../../lib/ff/metrics";
import { parseXForwardedFor } from "../../../lib/ff/net";
import { guardOverrideRequest } from "../../../lib/ff/override-guard";
import {
  parseFFQuery,
  applyOverrideDiff,
  validateOverridesCandidate,
  encodeOverridesCookie,
  readOverridesFromCookieHeader,
  filterDottedPaths,
  validateOverrideTypes,
} from "../../../lib/ff/overrides";

import { FF_COOKIE_DOMAIN, FF_COOKIE_PATH, FF_COOKIE_SECURE } from "@/lib/ff/cookies";

function removeFFParam(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("ff");
  return u.toString();
}

// S3-A: Node runtime for in-memory rate limiting
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // --- S3-A preflight guard (RL + optional prod token) ---
    const gate = guardOverrideRequest(req);
    if (!gate.allow) {
      return NextResponse.json(gate.body, { status: gate.code, headers: gate.headers });
    }

    const u = new URL(req.url);
    const ff = u.searchParams.get("ff");
    if (ff === null) {
      return NextResponse.json({ error: "Missing ff parameter" }, { status: 400 });
    }

    const candidate = parseFFQuery(ff, { allowDottedPaths: true });
    validateOverridesCandidate(candidate);

    const noDotted = filterDottedPaths(candidate);

    const prodStrict = process.env.NODE_ENV === "production";
    const enforceEnv = process.env.FF_ENFORCE_KNOWN_FLAGS === "true";
    const enforceKnown = prodStrict || enforceEnv;
    if (enforceKnown) {
      const unknown = Object.keys(noDotted).filter((name) => !isKnownFlag(name));
      if (unknown.length) {
        inc("override.400.unknown");
        return NextResponse.json(
          { error: "Unknown flags", unknown, known: knownFlags() },
          { status: 400 },
        );
      }
    }

    const typeCheck = validateOverrideTypes(noDotted);
    if (!typeCheck.ok) {
      inc("override.400.type");
      return NextResponse.json(
        { error: "Invalid override types", details: typeCheck.errors },
        { status: 400 },
      );
    }

    const ck = cookies();
    const existingRaw = ck.get("sv_flags_override")?.value;
    const existing = readOverridesFromCookieHeader(
      existingRaw ? `sv_flags_override=${existingRaw}` : undefined,
    );

    const next = applyOverrideDiff(existing, noDotted);
    const json = encodeOverridesCookie(next);

    // корректно определяем IP для логов/метрик (первый адрес из x-forwarded-for)
    const rawIp = req.headers.get("x-forwarded-for");
    const clientIp = parseXForwardedFor(rawIp);
    void clientIp; // (при необходимости можно логировать clientIp)
    const res = NextResponse.redirect(removeFFParam(req.url), { status: 302 });
    res.cookies.set("sv_flags_override", json, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60,
      secure: FF_COOKIE_SECURE,
      path: FF_COOKIE_PATH,
      domain: FF_COOKIE_DOMAIN,
    });
    return res;
  } catch (err) {
    const isDev = process.env.NODE_ENV !== "production";
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: isDev ? msg : "Invalid override format" }, { status: 400 });
  }
}
