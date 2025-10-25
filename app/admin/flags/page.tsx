import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import Link from "next/link";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  authorizeContext,
  type Role,
} from "@/lib/admin/rbac";
import { logAdminAction, readAuditRecent } from "@/lib/ff/audit";
import { FF } from "@/lib/ff/runtime";
import { createOverride } from "@/lib/ff/runtime/memory-store";
import type { FlagConfig, OverrideEntry, OverrideScope } from "@/lib/ff/runtime/types";
import { FlagConfigSchema } from "@/lib/ff/schema";
import { correlationFromNextContext } from "@/lib/metrics/correlation";
import type { PurgeSummary } from "@/lib/privacy/erasure";

const PAGE_PATH = "/admin/flags";

function roleAllows(role: Role, required: Role): boolean {
  const order: Record<Role, number> = { viewer: 0, ops: 1, admin: 2 };
  return order[role] >= order[required];
}

function scopeToLabel(scope: OverrideScope): string {
  switch (scope.type) {
    case "global":
      return "global";
    case "user":
      return `user:${scope.id}`;
    case "namespace":
      return `namespace:${scope.id}`;
    default:
      return scope.type;
  }
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts || Number.isNaN(ts)) return "—";
  return new Date(ts).toLocaleString();
}

function formatValue(value: boolean | number | string | null | undefined): string {
  if (value === null || typeof value === "undefined") return value === null ? "null" : "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatIdentifierSummary(ids: { sid?: string; aid?: string; userId?: string }): string {
  const parts: string[] = [];
  if (ids.userId) parts.push(`userId=${ids.userId}`);
  if (ids.sid) parts.push(`sid=${ids.sid}`);
  if (ids.aid) parts.push(`aid=${ids.aid}`);
  return parts.join(", ") || "unknown identifiers";
}

function formatPurgeSummary(purge: {
  vitals: PurgeSummary;
  errors: PurgeSummary;
  telemetry: PurgeSummary;
}): string {
  const segments: string[] = [];
  if (purge.vitals.purged) segments.push(`vitals ${purge.vitals.removed}`);
  if (purge.errors.purged) segments.push(`errors ${purge.errors.removed}`);
  if (purge.telemetry.purged) segments.push(`telemetry ${purge.telemetry.removed}`);
  if (segments.length === 0) {
    return "no purge";
  }
  return segments.join(", ");
}

async function ensureRole(required: Role): Promise<Role> {
  const hdrs = headers();
  const context = { headers: hdrs, cookieHeader: hdrs.get("cookie") };
  const result = authorizeContext(context, required);
  if (!result.ok) {
    throw new Error("Unauthorized");
  }
  const jar = cookies();
  jar.set(ADMIN_SESSION_COOKIE, result.sessionValue, ADMIN_SESSION_COOKIE_OPTIONS);
  return result.role;
}

async function upsertOverride(formData: FormData) {
  "use server";
  const role = await ensureRole("ops");
  const flag = String(formData.get("flag") ?? "").trim();
  const scopeType = String(formData.get("scopeType") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "").trim();
  const rawValue = String(formData.get("value") ?? "");
  const valueType = String(formData.get("valueType") ?? "string");
  const reasonRaw = String(formData.get("reason") ?? "").trim();

  if (!flag) throw new Error("Flag key is required");
  let scope: OverrideScope;
  if (scopeType === "global") {
    scope = { type: "global" };
  } else if (scopeType === "user") {
    if (!scopeId) throw new Error("User scope requires identifier");
    scope = { type: "user", id: scopeId };
  } else if (scopeType === "namespace") {
    if (!scopeId) throw new Error("Namespace scope requires identifier");
    scope = { type: "namespace", id: scopeId };
  } else {
    throw new Error("Unknown scope type");
  }

  let value: boolean | number | string;
  if (valueType === "boolean") {
    value = rawValue === "true";
  } else if (valueType === "number") {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) throw new Error("Invalid number value");
    value = parsed;
  } else {
    value = rawValue;
  }

  const reason = reasonRaw || undefined;
  const store = FF().store;
  const lock = FF().lock;
  const entry = createOverride(flag, scope, value, role, reason);
  const saved = await lock.withLock(flag, async () => store.putOverride(entry));
  const correlation = correlationFromNextContext();
  logAdminAction({
    timestamp: Date.now(),
    actor: role,
    action: "override_set",
    flag,
    scope: saved.scope,
    value: saved.value,
    reason,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  revalidatePath(PAGE_PATH);
}

async function removeOverride(formData: FormData) {
  "use server";
  const role = await ensureRole("ops");
  const flag = String(formData.get("flag") ?? "").trim();
  const scopeType = String(formData.get("scopeType") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "").trim();
  if (!flag) throw new Error("Flag key is required");
  let scope: OverrideScope;
  if (scopeType === "global") {
    scope = { type: "global" };
  } else if (scopeType === "user") {
    if (!scopeId) throw new Error("User scope requires identifier");
    scope = { type: "user", id: scopeId };
  } else if (scopeType === "namespace") {
    if (!scopeId) throw new Error("Namespace scope requires identifier");
    scope = { type: "namespace", id: scopeId };
  } else {
    throw new Error("Unknown scope type");
  }
  const store = FF().store;
  const lock = FF().lock;
  await lock.withLock(flag, async () => {
    await store.removeOverride(flag, scope);
  });
  const correlation = correlationFromNextContext();
  logAdminAction({
    timestamp: Date.now(),
    actor: role,
    action: "override_remove",
    flag,
    scope,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  revalidatePath(PAGE_PATH);
}

async function adjustRollout(formData: FormData) {
  "use server";
  const role = await ensureRole("ops");
  const flag = String(formData.get("flag") ?? "").trim();
  const delta = Number(formData.get("step"));
  const shadowParam = formData.get("shadow");
  if (!flag) throw new Error("Flag key is required");
  if (!Number.isFinite(delta)) throw new Error("Invalid step");
  const shadowRaw = typeof shadowParam === "string" ? shadowParam.trim() : undefined;
  const hasShadowParam = typeof shadowRaw === "string" && shadowRaw.length > 0;
  const nextShadowValue = hasShadowParam ? shadowRaw.toLowerCase() === "true" : undefined;
  const { store, lock, metrics } = FF();
  const existing = await store.getFlag(flag);
  if (!existing) throw new Error("Flag not found");
  const snapshot = await FF().snapshot();
  const requiresMetrics = (process.env.METRICS_PROVIDER || "self").toLowerCase() === "self";
  if (requiresMetrics && !metrics.hasData(snapshot.id)) {
    throw new Error("Metrics not available for rollout step");
  }
  const updated = await lock.withLock(flag, async () => {
    const current = await store.getFlag(flag);
    if (!current) throw new Error("Flag disappeared");
    const base = current.rollout?.percent ?? 0;
    const nextPercent = Math.max(0, Math.min(100, base + delta));
    const currentShadow = Boolean(current.rollout?.shadow);
    const nextShadow = hasShadowParam ? nextShadowValue === true : currentShadow;
    const percentChanged = Math.abs(base - nextPercent) >= 1e-6;
    if (!percentChanged && nextShadow === currentShadow) {
      return current;
    }
    const nextConfig: FlagConfig = {
      ...current,
      rollout: {
        ...(current.rollout ?? { percent: nextPercent }),
        percent: percentChanged ? nextPercent : base,
        shadow: nextShadow,
      },
      updatedAt: Date.now(),
    };
    FlagConfigSchema.parse(nextConfig);
    return store.putFlag(nextConfig);
  });
  const correlation = correlationFromNextContext();
  logAdminAction({
    timestamp: Date.now(),
    actor: role,
    action: "rollout_step",
    flag,
    nextPercent: updated.rollout?.percent ?? 0,
    shadow: hasShadowParam ? nextShadowValue === true : updated.rollout?.shadow,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  revalidatePath(PAGE_PATH);
}

async function toggleKill(formData: FormData) {
  "use server";
  const role = await ensureRole("admin");
  const enabled = String(formData.get("enable")) === "true";
  process.env.FF_KILL_ALL = enabled ? "true" : "false";
  const correlation = correlationFromNextContext();
  logAdminAction({
    timestamp: Date.now(),
    actor: role,
    action: "kill_switch",
    enabled,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    requestNamespace: correlation.namespace,
  });
  revalidatePath(PAGE_PATH);
}

function OverridesList({
  overrides,
  flag,
  canEdit,
}: {
  overrides: OverrideEntry[];
  flag: string;
  canEdit: boolean;
}) {
  if (overrides.length === 0) {
    return <p>No overrides.</p>;
  }
  return (
    <ul className="space-y-2">
      {overrides.map((entry) => {
        const key = `${entry.scope.type}:${"id" in entry.scope ? entry.scope.id : "global"}`;
        return (
          <li key={key} className="rounded border border-neutral-300 p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{scopeToLabel(entry.scope)}</p>
                <p className="text-sm text-neutral-600">Value: {formatValue(entry.value)}</p>
                {entry.reason && <p className="text-sm text-neutral-600">Reason: {entry.reason}</p>}
                {entry.author && <p className="text-sm text-neutral-600">Author: {entry.author}</p>}
                <p className="text-xs text-neutral-500">
                  Updated: {formatTimestamp(entry.updatedAt)}
                </p>
              </div>
              {canEdit && (
                <form action={removeOverride} method="post">
                  <input type="hidden" name="flag" value={flag} />
                  <input type="hidden" name="scopeType" value={entry.scope.type} />
                  {"id" in entry.scope && (
                    <input type="hidden" name="scopeId" value={entry.scope.id} />
                  )}
                  <button
                    className="rounded bg-red-100 px-3 py-1 text-sm text-red-800"
                    type="submit"
                  >
                    Remove
                  </button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AuditLog() {
  const records = readAuditRecent(50).slice().reverse();
  if (records.length === 0) return <p>No admin activity recorded yet.</p>;
  return (
    <ul className="space-y-2">
      {records.map((rec, idx) => {
        let description = "";
        switch (rec.action) {
          case "global_override_set":
            description = `set global override for ${rec.flag} → ${formatValue(rec.value)} (ttl ${rec.ttlSeconds}s)`;
            break;
          case "override_set":
            description = `set override ${scopeToLabel(rec.scope)} on ${rec.flag} → ${formatValue(rec.value)}`;
            break;
          case "override_remove":
            description = `removed override ${scopeToLabel(rec.scope)} on ${rec.flag}`;
            break;
          case "rollout_step":
            description = `set rollout of ${rec.flag} to ${rec.nextPercent}%`;
            if (rec.shadow) {
              description += " (shadow)";
            }
            break;
          case "rollout_blocked":
            description = `blocked rollout of ${rec.flag} (${rec.reason ?? "stop condition"})`;
            break;
          case "kill_switch":
            description = rec.enabled ? "enabled kill switch" : "disabled kill switch";
            break;
          case "privacy_erase":
            description = `processed privacy erase for ${formatIdentifierSummary(rec.identifiers)} (overrides removed ${rec.removedOverrides}, purge ${formatPurgeSummary(rec.purge)})`;
            break;
          default:
            description = rec.action;
        }
        return (
          <li key={`${rec.timestamp}-${idx}`} className="rounded border border-neutral-200 p-2">
            <p className="text-sm">
              <span className="font-semibold">{rec.actor}</span>: {description}
            </p>
            <p className="text-xs text-neutral-500">{formatTimestamp(rec.timestamp)}</p>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AdminFlagsPage() {
  noStore();
  const hdrs = headers();
  const auth = authorizeContext({ headers: hdrs, cookieHeader: hdrs.get("cookie") }, "viewer");
  if (!auth.ok) {
    throw new Error("Unauthorized");
  }
  const role = auth.role;
  const { store } = FF();
  const flags = store
    .listFlags()
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key));
  const overridesMap = new Map<string, OverrideEntry[]>(
    flags.map((flag) => [flag.key, store.listOverrides(flag.key)]),
  );
  const killAll = process.env.FF_KILL_ALL === "true";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Feature Flags Admin</h1>
        <p className="text-sm text-neutral-600">Current role: {role}</p>
        <nav className="flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-neutral-900 px-3 py-1 text-white">Flags</span>
          <Link
            className="rounded px-3 py-1 text-neutral-700 hover:bg-neutral-200"
            href="/admin/data-health"
          >
            Data Health
          </Link>
        </nav>
        <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
          <Link className="text-blue-700 underline" href="/api/telemetry/export">
            Export telemetry (ndjson)
          </Link>
          <Link className="text-blue-700 underline" href="/api/telemetry/export?fmt=csv">
            Export telemetry (csv)
          </Link>
        </div>
      </header>

      <section className="rounded border border-neutral-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Kill switch</h2>
            <p className="text-sm text-neutral-600">
              Global kill is currently{" "}
              {killAll ? <strong className="text-red-700">ENABLED</strong> : "disabled"}.
            </p>
          </div>
          {roleAllows(role, "admin") && (
            <form action={toggleKill} method="post" className="flex gap-2">
              <input type="hidden" name="enable" value={killAll ? "false" : "true"} />
              <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">
                {killAll ? "Disable" : "Enable"} kill
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Flags</h2>
        {flags.map((flag) => {
          const overrides = overridesMap.get(flag.key) ?? [];
          return (
            <article key={flag.key} className="rounded border border-neutral-300 p-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">{flag.key}</h3>
                {flag.description && <p className="text-sm text-neutral-600">{flag.description}</p>}
                <p className="text-sm text-neutral-700">
                  Default: <strong>{formatValue(flag.defaultValue)}</strong>
                </p>
                <p className="text-sm text-neutral-700">
                  Kill value:{" "}
                  <strong>
                    {typeof flag.defaultValue === "boolean"
                      ? formatValue(false)
                      : formatValue(flag.killValue)}
                  </strong>
                  {typeof flag.defaultValue !== "boolean" && flag.killValue === undefined && (
                    <span className="text-xs text-neutral-500"> (returns undefined)</span>
                  )}
                </p>
                <p className="text-sm text-neutral-700">
                  Enabled: {flag.enabled ? "yes" : "no"} · Kill: {flag.kill ? "yes" : "no"}
                </p>
                <p className="text-sm text-neutral-700">
                  Rollout: {flag.rollout?.percent ?? 0}%{flag.rollout?.shadow ? " (shadow)" : ""}
                </p>
                {flag.tags && flag.tags.length > 0 && (
                  <p className="text-sm text-neutral-600">Tags: {flag.tags.join(", ")}</p>
                )}
              </div>

              {roleAllows(role, "ops") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={adjustRollout} method="post">
                    <input type="hidden" name="flag" value={flag.key} />
                    <input type="hidden" name="step" value="-5" />
                    <input
                      type="hidden"
                      name="shadow"
                      value={flag.rollout?.shadow ? "true" : "false"}
                    />
                    <button className="rounded bg-neutral-200 px-3 py-1 text-sm" type="submit">
                      −5%
                    </button>
                  </form>
                  <form action={adjustRollout} method="post">
                    <input type="hidden" name="flag" value={flag.key} />
                    <input type="hidden" name="step" value="5" />
                    <input
                      type="hidden"
                      name="shadow"
                      value={flag.rollout?.shadow ? "true" : "false"}
                    />
                    <button className="rounded bg-neutral-200 px-3 py-1 text-sm" type="submit">
                      +5%
                    </button>
                  </form>
                  <form action={adjustRollout} method="post">
                    <input type="hidden" name="flag" value={flag.key} />
                    <input type="hidden" name="step" value="0" />
                    <input
                      type="hidden"
                      name="shadow"
                      value={flag.rollout?.shadow ? "false" : "true"}
                    />
                    <button
                      className="rounded bg-neutral-900 px-3 py-1 text-sm text-white"
                      type="submit"
                    >
                      {flag.rollout?.shadow ? "Disable shadow" : "Enable shadow"}
                    </button>
                  </form>
                </div>
              )}

              <div className="mt-4 space-y-3">
                <h4 className="text-md font-semibold">Overrides</h4>
                <OverridesList
                  overrides={overrides}
                  flag={flag.key}
                  canEdit={roleAllows(role, "ops")}
                />
                {roleAllows(role, "ops") && (
                  <form
                    action={upsertOverride}
                    method="post"
                    className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
                  >
                    <input type="hidden" name="flag" value={flag.key} />
                    <label className="flex flex-col text-sm">
                      Scope
                      <select
                        className="mt-1 rounded border border-neutral-300 p-2"
                        name="scopeType"
                        defaultValue="global"
                      >
                        <option value="global">Global</option>
                        <option value="user">User</option>
                        <option value="namespace">Namespace</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-sm">
                      Scope ID (for user/namespace)
                      <input
                        className="mt-1 rounded border border-neutral-300 p-2"
                        name="scopeId"
                        placeholder="identifier"
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      Value type
                      <select
                        className="mt-1 rounded border border-neutral-300 p-2"
                        name="valueType"
                        defaultValue="string"
                      >
                        <option value="string">String</option>
                        <option value="boolean">Boolean</option>
                        <option value="number">Number</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-sm">
                      Value
                      <input
                        className="mt-1 rounded border border-neutral-300 p-2"
                        name="value"
                        placeholder="Value"
                        required
                      />
                    </label>
                    <label className="col-span-full flex flex-col text-sm">
                      Reason (optional)
                      <input
                        className="mt-1 rounded border border-neutral-300 p-2"
                        name="reason"
                        placeholder="Reason"
                      />
                    </label>
                    <div className="col-span-full">
                      <button
                        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
                        type="submit"
                      >
                        Save override
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded border border-neutral-300 p-4">
        <h2 className="text-xl font-semibold">Audit log</h2>
        <AuditLog />
      </section>
    </main>
  );
}
