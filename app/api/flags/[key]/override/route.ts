import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeApi } from "@/lib/admin/rbac";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import { createOverride } from "@/lib/ff/runtime/memory-store";
import type { OverrideScope } from "@/lib/ff/runtime/types";

export const runtime = "nodejs";

const ScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user"), id: z.string().min(1) }),
  z.object({ type: z.literal("namespace"), id: z.string().min(1) }),
  z.object({ type: z.literal("global") }),
]);

const OverrideSchema = z.object({
  value: z.union([z.boolean(), z.string(), z.number()]),
  scope: ScopeSchema,
  reason: z.string().max(256).optional(),
  author: z.string().max(128).optional(),
});

export async function GET(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const key = params.key;
  const store = FF().store;
  const overrides = store.listOverrides(key);
  return auth.apply(NextResponse.json({ ok: true, overrides }));
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
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
  const store = FF().store;
  const lock = FF().lock;
  const { scope, value, reason, author } = parsed.data;
  const flagKey = params.key;
  const config = store.getFlag(flagKey);
  if (!config) {
    return auth.apply(NextResponse.json({ error: `Flag ${flagKey} not found` }, { status: 404 }));
  }
  const entry = createOverride(flagKey, scope as OverrideScope, value, author, reason);
  const saved = await lock.withLock(flagKey, async () => store.putOverride(entry));
  logAdminAction({
    timestamp: Date.now(),
    actor: auth.role,
    action: "override_upsert",
    flag: flagKey,
    scope: saved.scope,
    value: saved.value,
    reason,
  });
  return auth.apply(NextResponse.json({ ok: true, override: saved }));
}
