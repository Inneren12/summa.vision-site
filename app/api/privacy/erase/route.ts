import "server-only";

import path from "node:path";

import { NextResponse } from "next/server";

import { logAdminAction } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import { sanitizeUserId } from "@/lib/ff/stable-id";
import { correlationFromRequest } from "@/lib/metrics/correlation";
import { listNdjsonFiles } from "@/lib/metrics/ndjson";
import { readIdentifiers } from "@/lib/metrics/privacy";
import {
  appendErasure,
  purgeNdjsonFiles,
  type ErasureIdentifier,
  type PurgeFileReport,
} from "@/lib/privacy/erasure";

export const runtime = "nodejs";

const DEFAULT_VITALS_FILE = "./.runtime/vitals.ndjson";
const DEFAULT_ERRORS_FILE = "./.runtime/errors.ndjson";
const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";

const ROLE_HEADER = "x-ff-console-role";

async function metricsFiles(): Promise<string[]> {
  const bases = [
    process.env.METRICS_VITALS_FILE || DEFAULT_VITALS_FILE,
    process.env.METRICS_ERRORS_FILE || DEFAULT_ERRORS_FILE,
    process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const base of bases) {
    const files = await listNdjsonFiles(base);
    for (const file of files) {
      const resolved = path.resolve(file);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        result.push(resolved);
      }
    }
  }
  return result;
}

function coerceId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    const parsed = (await req.json()) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeRole(role: string | null): "admin" | "ops" | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin" || normalized === "ops") {
    return normalized;
  }
  return null;
}

function deriveIdentifiers(payload: Record<string, unknown>): {
  ids: ErasureIdentifier;
  invalidUser?: boolean;
} {
  const rawUserId = coerceId(payload.userId);
  let userId: string | undefined;
  if (rawUserId) {
    const normalized = sanitizeUserId(rawUserId);
    if (!normalized) {
      return { ids: {}, invalidUser: true };
    }
    userId = normalized;
  }
  const sid =
    coerceId(payload.sid) ||
    coerceId(payload.sv_id) ||
    coerceId(payload.stableId) ||
    coerceId(payload.sessionId);
  const aid =
    coerceId(payload.aid) ||
    coerceId(payload.ffAid) ||
    coerceId(payload.ff_aid) ||
    coerceId(payload.sv_aid);
  const stableId = coerceId(payload.stableId);
  const ids: ErasureIdentifier = {
    sid: sid ?? stableId,
    aid,
    userId,
    stableId,
  };
  return { ids };
}

async function selfErase(req: Request) {
  const { sid, aid } = readIdentifiers(req.headers);
  if (!sid && !aid) {
    return NextResponse.json({ error: "Missing identifiers" }, { status: 400 });
  }
  await appendErasure({ sid, aid }, "self");
  const files = await metricsFiles();
  await purgeNdjsonFiles(files, { sid, aid });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const roleHeader = req.headers.get(ROLE_HEADER);
  const role = normalizeRole(roleHeader);
  if (!role) {
    return selfErase(req);
  }

  const payload = await readJson(req);
  if (!payload) {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  const { ids, invalidUser } = deriveIdentifiers(payload);
  if (invalidUser) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!ids.sid && !ids.aid && !ids.userId && !ids.stableId) {
    return NextResponse.json({ error: "At least one identifier is required" }, { status: 400 });
  }

  await appendErasure(ids, role);
  const files = await metricsFiles();
  const purgeReport: PurgeFileReport[] = await purgeNdjsonFiles(files, ids);

  let removedOverrides = 0;
  if (ids.userId) {
    removedOverrides = await FF().store.deleteOverridesByUser(ids.userId);
  }

  const correlation = correlationFromRequest(req);
  logAdminAction({
    timestamp: Date.now(),
    actor: role,
    action: "privacy_erase",
    identifiers: ids,
    removedOverrides,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });

  return NextResponse.json({ ok: true, removedOverrides, purge: purgeReport });
}
