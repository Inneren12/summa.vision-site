import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { FF } from "@/lib/ff/runtime";
import type { FlagConfig, SegmentCondition } from "@/lib/ff/runtime/types";

export const runtime = "nodejs";

const SeedEnum = z.enum(["stableId", "user", "namespace", "cookie", "ipUa"]);

const ConditionSchema = z.object({
  field: z.enum(["user", "namespace", "cookie", "ip", "ua", "tag"]),
  op: z.literal("eq"),
  value: z.string().min(1),
});

const RolloutSchema = z
  .object({
    percent: z.number().min(0).max(100),
    salt: z.string().max(64).optional(),
    seedBy: SeedEnum.optional(),
  })
  .optional();

const SegmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  priority: z.number().int().min(0).default(0),
  conditions: z.array(ConditionSchema).optional(),
  override: z.union([z.boolean(), z.string(), z.number()]).optional(),
  rollout: RolloutSchema,
});

const FlagSchema = z.object({
  key: z.string().min(1),
  description: z.string().max(256).optional(),
  enabled: z.boolean().default(true),
  kill: z.boolean().optional(),
  seedByDefault: SeedEnum.optional(),
  defaultValue: z.union([z.boolean(), z.number(), z.string()]),
  tags: z.array(z.string().max(64)).optional(),
  rollout: RolloutSchema,
  segments: z.array(SegmentSchema).optional(),
});

function mapCondition(input: SegmentCondition): SegmentCondition {
  return { ...input };
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = FlagSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const payload = parsed.data;
  const store = FF().store;
  const lock = FF().lock;
  const config: FlagConfig = {
    key: payload.key,
    description: payload.description,
    enabled: payload.enabled,
    kill: payload.kill,
    seedByDefault: payload.seedByDefault,
    defaultValue: payload.defaultValue,
    tags: payload.tags,
    rollout: payload.rollout ? { ...payload.rollout } : undefined,
    segments: payload.segments?.map((seg) => ({
      ...seg,
      conditions: seg.conditions?.map(mapCondition),
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const updated = await lock.withLock(config.key, async () => store.putFlag(config));
  return NextResponse.json({ ok: true, flag: updated });
}
