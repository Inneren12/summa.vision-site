import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

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

export async function POST(req: Request, { params }: { params: { key: string } }) {
  if (process.env.FF_FREEZE_OVERRIDES === "true") {
    return NextResponse.json({ error: "Overrides are frozen" }, { status: 423 });
  }
  const json = await req.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = OverrideSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const store = FF().store;
  const lock = FF().lock;
  const { scope, value, reason, author } = parsed.data;
  const flagKey = params.key;
  const config = store.getFlag(flagKey);
  if (!config) {
    return NextResponse.json({ error: `Flag ${flagKey} not found` }, { status: 404 });
  }
  const entry = createOverride(flagKey, scope as OverrideScope, value, author, reason);
  const saved = await lock.withLock(flagKey, async () => store.putOverride(entry));
  return NextResponse.json({ ok: true, override: saved });
}
