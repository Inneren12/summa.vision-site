import type { OverrideScope, OverrideValue } from "./runtime/types";

export type AuditRecord =
  | {
      timestamp: number;
      actor: string;
      action: "global_override_set";
      flag: string;
      value: boolean | string | number;
      ttlSeconds: number;
      reason?: string;
      instanceId?: string;
    }
  | {
      timestamp: number;
      actor: string;
      action: "override_upsert";
      flag: string;
      scope: OverrideScope;
      value: OverrideValue;
      reason?: string;
    }
  | {
      timestamp: number;
      actor: string;
      action: "override_remove";
      flag: string;
      scope: OverrideScope;
    }
  | {
      timestamp: number;
      actor: string;
      action: "rollout_step";
      flag: string;
      delta: number;
      percent: number;
    }
  | {
      timestamp: number;
      actor: string;
      action: "kill_toggle";
      enabled: boolean;
    };

const MAX = 1000;
const LOG: AuditRecord[] = [];

export function logAdminAction(rec: AuditRecord) {
  LOG.push(rec);
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
