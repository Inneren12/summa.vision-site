import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeApi } from "@/lib/admin/rbac";
import { apiToFlag, flagToApi, normalizeNamespace } from "@/lib/ff/admin/api";
import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

const SeedEnum = z.enum(["userId", "cookie", "ipUa", "anonId"]);

const ConditionValueSchema = z.union([z.string().min(1), z.array(z.string().min(1))]);

const SegmentSchema = z.object({
  if: z.record(ConditionValueSchema).optional(),
  rollout: z
    .object({
      pct: z.number().min(0).max(100),
      seedBy: SeedEnum.optional(),
    })
    .optional(),
  override: z.boolean().optional(),
});

const RolloutStepSchema = z.object({
  pct: z.number().min(0).max(100),
  note: z.string().max(256).optional(),
  at: z.number().int().nonnegative().optional(),
});

const RolloutStopSchema = z
  .object({
    maxErrorRate: z.number().min(0).max(1).optional(),
    maxCLS: z.number().min(0).optional(),
    maxINP: z.number().min(0).optional(),
  })
  .optional();

const RolloutSchema = z
  .object({
    currentPct: z.number().min(0).max(100).optional(),
    steps: z.array(RolloutStepSchema).optional(),
    seedByDefault: SeedEnum.optional(),
    stop: RolloutStopSchema,
  })
  .optional();

const FlagSchema = z.object({
  key: z.string().min(1),
  namespace: z.string().min(1),
  default: z.boolean(),
  version: z.number().int().min(0).optional(),
  description: z.string().max(512).optional(),
  tags: z.array(z.string().min(1)).optional(),
  killSwitch: z.boolean().optional(),
  rollout: RolloutSchema,
  segments: z.array(SegmentSchema).optional(),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

export async function GET(req: Request) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const namespaceParam = url.searchParams.get("ns");
  const ns = namespaceParam ? normalizeNamespace(namespaceParam) : undefined;
  const store = FF().store;
  const flags = (await store.listFlags())
    .filter((flag) => (ns ? normalizeNamespace(flag.namespace) === ns : true))
    .map(flagToApi);
  const res = NextResponse.json({ ok: true, namespace: ns, flags });
  return auth.apply(res);
}

export async function POST(req: Request) {
  const auth = authorizeApi(req, "admin");
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => null);
  if (!json) {
    return auth.apply(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }
  const parsed = FlagSchema.safeParse(json);
  if (!parsed.success) {
    return auth.apply(
      NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    );
  }
  const payload = parsed.data;
  const { store, lock } = FF();
  const updated = await lock.withLock(payload.key, async () => {
    const existing = await store.getFlag(payload.key);
    const nextFlag = apiToFlag(payload, existing ?? undefined);
    return store.putFlag(nextFlag);
  });
  const res = NextResponse.json({ ok: true, flag: flagToApi(updated) });
  return auth.apply(res);
}
