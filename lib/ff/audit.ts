import type { OverrideScope, OverrideValue } from "./runtime/types";

type AuditMetadata = {
  timestamp: number;
  actor: string;
  requestId?: string | null;
  sessionId?: string | null;
  requestNamespace?: string | null;
};

export type AuditRecord =
  | (AuditMetadata & {
      action: "global_override_set";
      flag: string;
      value: boolean | string | number;
      ttlSeconds: number;
      reason?: string;
      instanceId?: string;
    })
  | (AuditMetadata & {
      action: "override_set";
      flag: string;
      scope: OverrideScope;
      value: OverrideValue;
      ttlSeconds?: number;
      reason?: string;
    })
  | (AuditMetadata & {
      action: "override_remove";
      flag: string;
      scope: OverrideScope;
    })
  | (AuditMetadata & {
      action: "rollout_step";
      flag: string;
      nextPercent: number;
      shadow?: boolean;
    })
  | (AuditMetadata & {
      action: "rollout_blocked";
      flag: string;
      reason?: string;
      limit?: number;
      actual?: number;
      errorRate?: number;
      cls?: number;
      inp?: number;
      denom?: number;
    })
  | (AuditMetadata & {
      action: "kill_switch";
      enabled: boolean;
      flags?: string[];
      namespace?: string;
      reason?: string;
    })
  | (AuditMetadata & {
      action: "snapshot_restore";
      flags: number;
      overrides: number;
    })
  | (AuditMetadata & {
      action: "privacy_erase";
      identifiers: { sid?: string; aid?: string; userId?: string; stableId?: string };
      removedOverrides: number;
    })
  | (AuditMetadata & {
      action: "privacy_export";
      identifiers: {
        sid?: string | null;
        aid?: string | null;
        userId?: string | null;
        stableId?: string | null;
      };
      recordCount: number;
    });

const MAX = 1000;
const LOG: AuditRecord[] = [];

export function logAdminAction(rec: AuditRecord) {
  LOG.push({
    ...rec,
    requestId: rec.requestId ?? null,
    sessionId: rec.sessionId ?? null,
    requestNamespace: rec.requestNamespace ?? null,
  });
  if (LOG.length > MAX) LOG.shift();
}

export function readAuditRecent(limit = 200): AuditRecord[] {
  const n = Math.max(1, Math.min(limit, MAX));
  return LOG.slice(-n);
}

// tests-only
export function __clearAudit() {
  LOG.length = 0;
}
