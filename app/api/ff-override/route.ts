import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isKnownFlag, knownFlags } from "../../../lib/ff/flags";
import {
  parseFFQuery,
  applyOverrideDiff,
  validateOverridesCandidate,
  encodeOverridesCookie,
  readOverridesFromCookieHeader,
  type Overrides,
} from "../../../lib/ff/overrides";

function removeFFParam(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("ff");
  return u.toString();
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const ff = u.searchParams.get("ff");
    if (ff === null) {
      return NextResponse.json({ error: "Missing ff parameter" }, { status: 400 });
    }

    const isProd = process.env.NODE_ENV === "production";
    const allowDotted = !isProd && process.env.ALLOW_DOTTED_OVERRIDE === "true";
    const diff = parseFFQuery(ff, { allowDottedPaths: allowDotted });

    const ck = cookies();
    const existingRaw = ck.get("sv_flags_override")?.value;
    const existing = readOverridesFromCookieHeader(
      existingRaw ? `sv_flags_override=${existingRaw}` : undefined,
    );

    const candidate = applyOverrideDiff(existing, diff);
    validateOverridesCandidate(candidate);

    const enforceKnown = process.env.FF_ENFORCE_KNOWN_FLAGS === "true";
    if (enforceKnown) {
      const unknown = Object.keys(candidate).filter((name) => !isKnownFlag(name));
      if (unknown.length) {
        return NextResponse.json(
          { error: "Unknown flags", unknown, known: knownFlags() },
          { status: 400 },
        );
      }
    }

    const json = encodeOverridesCookie(candidate as Overrides);

    const res = NextResponse.redirect(removeFFParam(req.url), { status: 302 });
    res.cookies.set("sv_flags_override", json, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
      secure: isProd,
    });
    return res;
  } catch (err) {
    const isDev = process.env.NODE_ENV !== "production";
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: isDev ? msg : "Invalid override format" }, { status: 400 });
  }
}
