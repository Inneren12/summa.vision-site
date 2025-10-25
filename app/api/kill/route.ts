import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAdminCsrf } from "@/lib/admin/csrf";
import { beginIdempotentRequest } from "@/lib/admin/idempotency";
import { enforceAdminRateLimit, resolveKillSwitchRpm } from "@/lib/admin/rate-limit";
import { authorizeApi } from "@/lib/admin/rbac";
import { normalizeNamespace } from "@/lib/ff/admin/api";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import { FlagConfigSchema } from "@/lib/ff/schema";
import { correlationFromRequest } from "@/lib/metrics/correlation";

export const runtime = "nodejs";

const KillSchema = z.object({
  enable: z.boolean(),
  namespace: z.string().min(1).optional(),
  flags: z.array(z.string().min(1)).optional(),
  reason: z.string().max(512).optional(),
});

export async function POST(req: Request) {
  const auth = authorizeApi(req, "admin");
  if (!auth.ok) return auth.response;
  const csrf = enforceAdminCsrf(req, auth.source);
  if (!csrf.ok) {
    return auth.apply(csrf.response);
  }
  const idempotency = beginIdempotentRequest(req);
  if (idempotency.kind === "error") {
    return auth.apply(idempotency.response);
  }
  if (idempotency.kind === "hit") {
    return auth.apply(idempotency.response);
  }
  const finalize = async (res: NextResponse) => {
    const applied = auth.apply(res);
    await idempotency.store(applied);
    return applied;
  };
  const correlation = correlationFromRequest(req);
  const limit = resolveKillSwitchRpm();
  const gate = await enforceAdminRateLimit({
    req,
    scope: "kill",
    rpm: limit,
    actor: { role: auth.role, session: auth.session },
  });
  if (!gate.ok) {
    return finalize(gate.response);
  }
  const json = await req.json().catch(() => null);
  const candidate: Record<string, unknown> = json && typeof json === "object" ? { ...json } : {};
  if (candidate.enable === undefined && typeof candidate.enabled === "boolean") {
    candidate.enable = candidate.enabled;
  }
  const parsed = KillSchema.safeParse(candidate);
  if (!parsed.success) {
    return finalize(
      NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }
  const { enable, namespace: nsInput, flags, reason } = parsed.data;
  const { store, lock } = FF();
  const now = Date.now();
  const appliedFlags = new Set<string>();

  async function applyKill(flagKey: string) {
    return lock.withLock(flagKey, async () => {
      const current = await store.getFlag(flagKey);
      if (!current) return { ok: true, skipped: true } as const;
      const next = {
        ...current,
        kill: enable,
        killSwitch: enable,
        updatedAt: now,
      };
      const parsed = FlagConfigSchema.safeParse(next);
      if (!parsed.success) {
        return { ok: false, error: parsed.error } as const;
      }
      await store.putFlag(parsed.data);
      return { ok: true, skipped: false } as const;
    });
  }

  if (flags && flags.length > 0) {
    for (const flagKey of flags) {
      const result = await applyKill(flagKey);
      if (!result.ok) {
        return finalize(
          NextResponse.json(
            { error: "Flag config invalid", flag: flagKey, details: result.error.flatten() },
            { status: 400 },
          ),
        );
      }
      if (!result.skipped) {
        appliedFlags.add(flagKey);
      }
    }
    if (appliedFlags.size === 0) {
      return finalize(NextResponse.json({ error: "No matching flags" }, { status: 404 }));
    }
    logAdminAction({
      timestamp: now,
      actor: auth.role,
      action: "kill_switch",
      enabled: enable,
      flags: Array.from(appliedFlags),
      namespace: undefined,
      reason,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      requestNamespace: correlation.namespace,
    });
    return finalize(
      NextResponse.json({
        ok: true,
        scope: "flags",
        flags: Array.from(appliedFlags),
        enabled: enable,
      }),
    );
  }

  if (nsInput) {
    const namespace = normalizeNamespace(nsInput);
    const allFlags = await store.listFlags();
    const matched = allFlags.filter((flag) => normalizeNamespace(flag.namespace) === namespace);
    if (matched.length === 0) {
      return finalize(
        NextResponse.json({ error: `No flags for namespace ${namespace}` }, { status: 404 }),
      );
    }
    for (const flag of matched) {
      const result = await applyKill(flag.key);
      if (!result.ok) {
        return finalize(
          NextResponse.json(
            { error: "Flag config invalid", flag: flag.key, details: result.error.flatten() },
            { status: 400 },
          ),
        );
      }
      if (!result.skipped) {
        appliedFlags.add(flag.key);
      }
    }
    logAdminAction({
      timestamp: now,
      actor: auth.role,
      action: "kill_switch",
      enabled: enable,
      flags: Array.from(appliedFlags),
      namespace,
      reason,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      requestNamespace: correlation.namespace,
    });
    return finalize(
      NextResponse.json({
        ok: true,
        scope: "namespace",
        namespace,
        flags: Array.from(appliedFlags),
        enabled: enable,
      }),
    );
  }

  process.env.FF_KILL_ALL = enable ? "true" : "false";
  logAdminAction({
    timestamp: now,
    actor: auth.role,
    action: "kill_switch",
    enabled: enable,
    flags: undefined,
    namespace: undefined,
    reason,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  return finalize(NextResponse.json({ ok: true, scope: "global", enabled: enable, reason }));
}
