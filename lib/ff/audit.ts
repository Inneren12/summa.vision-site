export type AuditRecord = {
  timestamp: number;
  actor: "admin";
  action: "global_override_set";
  flag: string;
  value: boolean | string | number;
  ttlSeconds: number;
  reason?: string;
  instanceId?: string;
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
