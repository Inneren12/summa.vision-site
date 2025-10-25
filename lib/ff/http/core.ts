import { z } from "zod";

import type { CoreResponse, CookieUpdate, RequestLike } from "./types";

import { apiToFlag, flagToApi, normalizeNamespace } from "@/lib/ff/admin/api";
import { stableCookieOptions } from "@/lib/ff/cookies";
import { isKnownFlag, knownFlags, FLAG_REGISTRY } from "@/lib/ff/flags";
import { inc } from "@/lib/ff/metrics";
import { parseXForwardedFor } from "@/lib/ff/net";
import { guardOverrideRequest } from "@/lib/ff/override-guard";
import {
  applyOverrideDiff,
  encodeOverridesCookie,
  filterDottedPaths,
  parseFFQuery,
  readOverridesFromCookieHeader,
  validateOverrideTypes,
  validateOverridesCandidate,
} from "@/lib/ff/overrides";
import { FF } from "@/lib/ff/runtime";
import { FlagConfigSchema } from "@/lib/ff/schema";
import { STABLEID_USER_PREFIX } from "@/lib/ff/stable-id";
import { correlationFromHeaders } from "@/lib/metrics/correlation";

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): CoreResponse {
  return { kind: "json", status, body, headers };
}

function redirectResponse(
  status: number,
  location: string,
  cookies?: CookieUpdate[],
  headers?: Record<string, string>,
): CoreResponse {
  return { kind: "redirect", status, location, cookies, headers };
}

const SeedEnum = z.enum(["userId", "cookie", "ipUa", "anonId", "stableId"]);

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
    shadow: z.boolean().optional(),
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
  killValue: z.union([z.boolean(), z.number(), z.string(), z.null()]).optional(),
  rollout: RolloutSchema,
  segments: z.array(SegmentSchema).optional(),
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

function removeFFParam(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("ff");
  return u.toString();
}

export async function handleFlags(req: RequestLike): Promise<CoreResponse> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const namespaceParam = url.searchParams.get("ns");
    const ns = namespaceParam ? normalizeNamespace(namespaceParam) : undefined;
    const store = FF().store;
    const flags = (await store.listFlags())
      .filter((flag) => (ns ? normalizeNamespace(flag.namespace) === ns : true))
      .map(flagToApi);
    return jsonResponse(200, { ok: true, namespace: ns, flags });
  }

  if (req.method === "POST") {
    const json = await req.json().catch(() => null);
    if (!json) {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    const parsed = FlagSchema.safeParse(json);
    if (!parsed.success) {
      return jsonResponse(400, { error: "Validation failed", details: parsed.error.flatten() });
    }
    const payload = parsed.data;
    const { store, lock } = FF();
    const updated = await lock.withLock(payload.key, async () => {
      const existing = await store.getFlag(payload.key);
      const nextFlag = apiToFlag(payload, existing ?? undefined);
      const parsedFlag = FlagConfigSchema.safeParse(nextFlag);
      if (!parsedFlag.success) {
        return { ok: false, error: parsedFlag.error } as const;
      }
      const saved = await store.putFlag(parsedFlag.data);
      return { ok: true, flag: saved } as const;
    });
    if (!updated.ok) {
      return jsonResponse(400, {
        error: "Flag config invalid",
        details: updated.error.flatten(),
      });
    }
    return jsonResponse(200, { ok: true, flag: flagToApi(updated.flag) });
  }

  return jsonResponse(405, { error: "Method not allowed" }, { Allow: "GET, POST" });
}

export async function handleFlag(req: RequestLike, key: string): Promise<CoreResponse> {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" }, { Allow: "GET" });
  }
  const store = FF().store;
  const flag = await store.getFlag(key);
  if (!flag) {
    return jsonResponse(404, { error: `Flag ${key} not found` });
  }
  const overrides = await store.listOverrides(key);
  return jsonResponse(200, { ok: true, flag: flagToApi(flag), overrides });
}

export async function handleOverride(req: RequestLike): Promise<CoreResponse> {
  try {
    const gate = await guardOverrideRequest(req);
    if (!gate.allow) {
      return jsonResponse(gate.code, gate.body, gate.headers);
    }

    const url = new URL(req.url);
    const ff = url.searchParams.get("ff");
    if (ff === null) {
      return jsonResponse(400, { error: "Missing ff parameter" });
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
        return jsonResponse(400, { error: "Unknown flags", unknown, known: knownFlags() });
      }
    }

    const typeCheck = validateOverrideTypes(noDotted);
    if (!typeCheck.ok) {
      inc("override.400.type");
      return jsonResponse(400, {
        error: "Invalid override types",
        details: typeCheck.errors,
      });
    }

    const existingRaw = req.cookies.get("sv_flags_override");
    const existing = readOverridesFromCookieHeader(
      existingRaw ? `sv_flags_override=${existingRaw}` : undefined,
    );
    const next = applyOverrideDiff(existing, noDotted);
    const json = encodeOverridesCookie(next);

    const rawIp = req.headers.get("x-forwarded-for");
    const clientIp = parseXForwardedFor(rawIp ?? undefined);
    void clientIp;

    const cookie: CookieUpdate = {
      name: "sv_flags_override",
      value: json,
      options: stableCookieOptions({ httpOnly: false, maxAge: 60 * 60 }),
    };

    return redirectResponse(302, removeFFParam(req.url), [cookie]);
  } catch (err) {
    const isDev = process.env.NODE_ENV !== "production";
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse(400, { error: isDev ? msg : "Invalid override format" });
  }
}

const ALLOWED_SOURCES = ["global", "override", "env", "default"] as const;

type ExposureSource = (typeof ALLOWED_SOURCES)[number];

function sanitizeValue(value: unknown): boolean | string | number | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  if (typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
    return value;
  }
  return undefined;
}

function resolveStableId(req: RequestLike): { stableId: string; userId?: string } {
  const cookieId = req.cookies.get("sv_id") ?? "anon";
  const stableId = cookieId || "anon";
  const userId = stableId.startsWith(STABLEID_USER_PREFIX)
    ? stableId.slice(STABLEID_USER_PREFIX.length)
    : undefined;
  return { stableId, userId };
}

export async function handleExposure(req: RequestLike): Promise<CoreResponse> {
  if (req.headers.get("dnt") === "1") {
    return jsonResponse(200, { ok: true });
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return jsonResponse(415, { error: "Invalid content type" });
  }

  const rawBody = await req.text();
  if (rawBody.length > 2048) {
    return jsonResponse(413, { error: "Payload too large" });
  }

  let parsed: unknown;
  try {
    parsed = rawBody.length ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse(400, { error: "Malformed JSON" });
  }

  if (typeof parsed !== "object" || parsed === null) {
    return jsonResponse(400, { error: "Invalid payload" });
  }

  const body = parsed as Record<string, unknown>;
  const flag = typeof body.flag === "string" ? body.flag : "";
  const source = typeof body.source === "string" ? (body.source as ExposureSource) : undefined;
  const value = sanitizeValue(body.value);

  if (!flag || !source || !ALLOWED_SOURCES.includes(source) || value === undefined) {
    return jsonResponse(400, { error: "Invalid payload" });
  }

  const { stableId, userId } = resolveStableId(req);
  const correlation = correlationFromHeaders({
    get(name: string) {
      if (name.toLowerCase() === "cookie") {
        const value = req.headers.get("cookie");
        return value ?? (stableId ? `sv_id=${stableId}` : null);
      }
      return req.headers.get(name);
    },
  });

  try {
    const meta = FLAG_REGISTRY[flag as keyof typeof FLAG_REGISTRY];
    const safeValue = meta?.sensitive ? "[redacted]" : value;
    FF().telemetrySink.emit({
      ts: Date.now(),
      type: "exposure",
      flag,
      value: safeValue,
      source,
      stableId,
      userId,
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      namespace: correlation.namespace,
    });
  } catch {
    // ignore telemetry errors
  }

  return jsonResponse(200, { ok: true });
}
