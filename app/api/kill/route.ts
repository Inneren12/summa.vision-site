import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeApi } from "@/lib/admin/rbac";
import { normalizeNamespace } from "@/lib/ff/admin/api";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";

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
  const json = await req.json().catch(() => null);
  const candidate: Record<string, unknown> = json && typeof json === "object" ? { ...json } : {};
  if (candidate.enable === undefined && typeof candidate.enabled === "boolean") {
    candidate.enable = candidate.enabled;
  }
  const parsed = KillSchema.safeParse(candidate);
  if (!parsed.success) {
    return auth.apply(
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

  if (flags && flags.length > 0) {
    for (const flagKey of flags) {
      await lock.withLock(flagKey, async () => {
        const current = store.getFlag(flagKey);
        if (!current) return;
        const next = {
          ...current,
          kill: enable,
          killSwitch: enable,
          updatedAt: now,
        };
        store.putFlag(next);
        appliedFlags.add(flagKey);
      });
    }
    if (appliedFlags.size === 0) {
      return auth.apply(NextResponse.json({ error: "No matching flags" }, { status: 404 }));
    }
    logAdminAction({
      timestamp: now,
      actor: auth.role,
      action: "kill_switch",
      enabled: enable,
      flags: Array.from(appliedFlags),
      namespace: undefined,
      reason,
    });
    return auth.apply(
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
    const allFlags = store.listFlags();
    const matched = allFlags.filter((flag) => normalizeNamespace(flag.namespace) === namespace);
    if (matched.length === 0) {
      return auth.apply(
        NextResponse.json({ error: `No flags for namespace ${namespace}` }, { status: 404 }),
      );
    }
    for (const flag of matched) {
      await lock.withLock(flag.key, async () => {
        const current = store.getFlag(flag.key);
        if (!current) return;
        const next = {
          ...current,
          kill: enable,
          killSwitch: enable,
          updatedAt: now,
        };
        store.putFlag(next);
        appliedFlags.add(flag.key);
      });
    }
    logAdminAction({
      timestamp: now,
      actor: auth.role,
      action: "kill_switch",
      enabled: enable,
      flags: Array.from(appliedFlags),
      namespace,
      reason,
    });
    return auth.apply(
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
  });
  return auth.apply(NextResponse.json({ ok: true, scope: "global", enabled: enable, reason }));
}
