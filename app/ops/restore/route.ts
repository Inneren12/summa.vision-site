import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeApi } from "@/lib/admin/rbac";
import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import { restoreSnapshot } from "@/lib/ff/runtime/snapshot";

export const runtime = "nodejs";

const SeedBySchema = z.enum([
  "stableId",
  "anonId",
  "user",
  "userId",
  "namespace",
  "cookie",
  "ipUa",
]);

const RolloutStepSchema = z.object({
  pct: z.number().finite(),
  note: z.string().optional(),
  at: z.number().finite().optional(),
});

const RolloutSchema = z
  .object({
    percent: z.number().finite(),
    salt: z.string().optional(),
    seedBy: SeedBySchema.optional(),
    seedByDefault: SeedBySchema.optional(),
    steps: z.array(RolloutStepSchema).optional(),
    stop: z
      .object({
        maxErrorRate: z.number().finite().min(0).max(1).optional(),
        maxCLS: z.number().finite().min(0).optional(),
        maxINP: z.number().finite().min(0).optional(),
      })
      .optional(),
    hysteresis: z
      .object({
        errorRate: z.number().finite().min(0).max(1).optional(),
        CLS: z.number().finite().min(0).optional(),
        INP: z.number().finite().min(0).optional(),
      })
      .optional(),
  })
  .partial({ percent: true })
  .strip();

const SegmentConditionSchema = z.union([
  z.object({
    field: z.enum(["user", "namespace", "cookie", "ip", "ua"]),
    op: z.literal("eq"),
    value: z.string(),
  }),
  z.object({ field: z.literal("tag"), op: z.literal("eq"), value: z.string() }),
]);

const SegmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  priority: z.number().finite(),
  conditions: z.array(SegmentConditionSchema).optional(),
  override: z.union([z.boolean(), z.string(), z.number()]).optional(),
  rollout: RolloutSchema.optional(),
  namespace: z.string().optional(),
});

const FlagSchema = z.object({
  key: z.string().min(1),
  namespace: z.string().optional(),
  version: z.number().finite().optional(),
  description: z.string().optional(),
  enabled: z.boolean(),
  kill: z.boolean().optional(),
  killSwitch: z.boolean().optional(),
  seedByDefault: SeedBySchema.optional(),
  defaultValue: z.union([z.boolean(), z.string(), z.number()]),
  tags: z.array(z.string()).optional(),
  rollout: RolloutSchema.optional(),
  segments: z.array(SegmentSchema).optional(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

const OverrideScopeSchema = z.union([
  z.object({ type: z.literal("user"), id: z.string().min(1) }),
  z.object({ type: z.literal("namespace"), id: z.string().min(1) }),
  z.object({ type: z.literal("global") }),
]);

const OverrideSchema = z.object({
  flag: z.string().min(1),
  scope: OverrideScopeSchema,
  value: z.union([z.boolean(), z.string(), z.number()]),
  reason: z.string().optional(),
  author: z.string().optional(),
  ttlSeconds: z.number().finite().optional(),
  expiresAt: z.number().finite().optional(),
  updatedAt: z.number().finite(),
});

const SnapshotSchema = z.object({
  flags: z.array(FlagSchema).default([]),
  overrides: z.array(OverrideSchema).default([]),
});

const SNAPSHOT_LOCK_KEY = "snapshot:restore";

export async function POST(req: Request) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const text = await req.text();
  if (!text) {
    return auth.apply(NextResponse.json({ error: "Empty body" }, { status: 400 }));
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return auth.apply(NextResponse.json({ error: "Malformed JSON" }, { status: 400 }));
  }
  const snapshot = SnapshotSchema.safeParse(parsed);
  if (!snapshot.success) {
    return auth.apply(
      NextResponse.json(
        { error: "Validation failed", details: snapshot.error.flatten() },
        { status: 400 },
      ),
    );
  }
  const { flags, overrides } = snapshot.data;
  const { store, lock } = FF();
  await lock.withLock(SNAPSHOT_LOCK_KEY, async () => {
    restoreSnapshot(store, snapshot.data);
  });
  logAdminAction({
    timestamp: Date.now(),
    actor: auth.role,
    action: "snapshot_restore",
    flags: flags.length,
    overrides: overrides.length,
  });
  return auth.apply(
    NextResponse.json(
      { ok: true, flags: flags.length, overrides: overrides.length },
      { status: 200 },
    ),
  );
}
