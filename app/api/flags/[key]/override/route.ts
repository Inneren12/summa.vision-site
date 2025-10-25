import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAdminRateLimit, resolveOverrideRpm } from "@/lib/admin/rate-limit";
import { authorizeApi } from "@/lib/admin/rbac";
import { normalizeNamespace } from "@/lib/ff/admin/api";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import { createOverride } from "@/lib/ff/runtime/memory-store";
import type { OverrideEntry, OverrideScope } from "@/lib/ff/runtime/types";
import { correlationFromRequest } from "@/lib/metrics/correlation";

export const runtime = "nodejs";

const OverrideSchema = z.object({
  namespace: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  value: z.boolean(),
  reason: z.string().max(512).optional(),
  ttlSec: z.number().int().min(0).optional(),
});

function scopesEqual(a: OverrideScope, b: OverrideScope): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "global") return true;
  return a.id === b.id;
}

function findMatchingOverride(
  overrides: OverrideEntry[],
  scope: OverrideScope,
): OverrideEntry | undefined {
  return overrides.find((entry) => scopesEqual(entry.scope, scope));
}

export async function GET(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const key = params.key;
  const store = FF().store;
  const overrides = await store.listOverrides(key);
  return auth.apply(NextResponse.json({ ok: true, overrides }));
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const correlation = correlationFromRequest(req);
  const limit = resolveOverrideRpm();
  const gate = await enforceAdminRateLimit({
    req,
    scope: "override",
    rpm: limit,
    actor: { role: auth.role, session: auth.session },
  });
  if (!gate.ok) {
    return auth.apply(gate.response);
  }
  if (process.env.FF_FREEZE_OVERRIDES === "true") {
    return auth.apply(NextResponse.json({ error: "Overrides are frozen" }, { status: 423 }));
  }
  const json = await req.json().catch(() => null);
  if (!json) {
    return auth.apply(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }
  const parsed = OverrideSchema.safeParse(json);
  if (!parsed.success) {
    return auth.apply(
      NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }
  const { namespace: nsInput, userId, value, reason, ttlSec } = parsed.data;
  const flagKey = params.key;
  const { store, lock } = FF();
  const config = await store.getFlag(flagKey);
  if (!config) {
    return auth.apply(NextResponse.json({ error: `Flag ${flagKey} not found` }, { status: 404 }));
  }
  const normalizedNamespace = nsInput ? normalizeNamespace(nsInput) : undefined;
  let scope: OverrideScope;
  if (userId) {
    scope = { type: "user", id: userId };
  } else if (normalizedNamespace) {
    scope = { type: "namespace", id: normalizedNamespace };
  } else {
    scope = { type: "global" };
  }

  const result = await lock.withLock(flagKey, async () => {
    const existing = findMatchingOverride(await store.listOverrides(flagKey), scope);
    if (typeof ttlSec === "number" && ttlSec <= 0) {
      if (existing) {
        await store.removeOverride(flagKey, scope);
        return { removed: true, previous: existing } as const;
      }
      return { removed: false } as const;
    }
    const entry = createOverride(flagKey, scope, value, auth.role, reason, ttlSec);
    const saved = await store.putOverride(entry);
    return { saved } as const;
  });

  if ("removed" in result) {
    if (result.removed) {
      logAdminAction({
        timestamp: Date.now(),
        actor: auth.role,
        action: "override_remove",
        flag: flagKey,
        scope,
        requestId: correlation.requestId,
        sessionId: correlation.sessionId,
        requestNamespace: correlation.namespace,
      });
    }
    return auth.apply(new NextResponse(null, { status: 204 }));
  }

  logAdminAction({
    timestamp: Date.now(),
    actor: auth.role,
    action: "override_set",
    flag: flagKey,
    scope: result.saved.scope,
    value,
    ttlSeconds: ttlSec,
    reason,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  return auth.apply(NextResponse.json({ ok: true, override: result.saved }));
}
