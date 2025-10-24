import { z } from "zod";

import { FLAG_REGISTRY, isKnownFlag } from "./flags";
import type { VariantConfig } from "./shared";

// ---- Limits (cookie safety across browsers) ----
export const MAX_OVERRIDE_SIZE_BYTES = 3000; // safe under per-cookie limits
export const MAX_OVERRIDE_KEYS = 50;
export const MAX_STRING_LEN = 256;
export const MIN_NUMBER = -1e6;
export const MAX_NUMBER = 1e6;

// parse "name:value,name2:\"str\",name3:25"
function splitPairs(ff: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false; // inside quotes
  for (let i = 0; i < ff.length; i++) {
    const ch = ff[i];
    if (ch === '"') {
      q = !q;
      cur += ch;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

function parseSingleValue(raw: string): string | number | boolean | null {
  const v = raw.trim();
  if (v === "true" || v === "on") return true;
  if (v === "false" || v === "off") return false;
  if (v === "null") return null;
  if (v === "undefined") throw new Error("undefined is not a valid override value");
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  // number?
  if (!Number.isNaN(Number(v)) && v !== "") return Number(v);
  return v; // unquoted string (allowed)
}

export type OverrideDiff = Record<string, string | number | boolean | null>;

/** Parse ff query into a diff map; dotted paths optionally allowed in dev only. */
export function parseFFQuery(
  ff: string,
  { allowDottedPaths = false }: { allowDottedPaths?: boolean } = {},
): OverrideDiff {
  const pairs = splitPairs(ff);
  const out: OverrideDiff = {};
  for (const p of pairs) {
    const idx = p.indexOf(":");
    if (idx === -1) throw new Error(`Invalid pair "${p}" (expected name:value)`);
    const rawKey = p.slice(0, idx).trim();
    const key = rawKey;
    if (!allowDottedPaths && key.includes(".")) {
      // ignore dotted path in prod/dev when disabled
      continue;
    }
    const val = parseSingleValue(p.slice(idx + 1));
    out[key] = val;
  }
  return out;
}

/** Apply diff to existing overrides: null => delete key, otherwise set. */
export function applyOverrideDiff(existing: Overrides, diff: OverrideDiff): Overrides {
  const next: Overrides = { ...existing };
  for (const [k, v] of Object.entries(diff)) {
    if (v === null) {
      delete next[k];
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      next[k] = v;
    }
  }
  return next;
}

// ---- Validation ----
export const OverridesSchema = z.record(z.union([z.boolean(), z.number(), z.string()]));
export type Overrides = Record<string, boolean | number | string>;

export function validateOverridesCandidate(obj: Record<string, unknown>) {
  // check keys count
  const keys = Object.keys(obj);
  if (keys.length > MAX_OVERRIDE_KEYS) {
    throw new Error(`Too many overrides: ${keys.length} (max ${MAX_OVERRIDE_KEYS})`);
  }
  // check each value
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) {
      continue; // null означает удаление override
    }
    if (typeof v === "string") {
      if (v.length > MAX_STRING_LEN)
        throw new Error(`String too long for "${k}" (max ${MAX_STRING_LEN})`);
    } else if (typeof v === "number") {
      if (!Number.isFinite(v) || v < MIN_NUMBER || v > MAX_NUMBER) {
        throw new Error(`Number out of range for "${k}" (allowed ${MIN_NUMBER}..${MAX_NUMBER})`);
      }
    } else if (typeof v === "boolean") {
      /* ok */
    } else {
      throw new Error(`Invalid value type for "${k}"`);
    }
  }
}

export function encodeOverridesCookie(o: Overrides): string {
  const json = JSON.stringify(o);
  if (json.length > MAX_OVERRIDE_SIZE_BYTES) {
    throw new Error(`Overrides too large: ${json.length} bytes (max ${MAX_OVERRIDE_SIZE_BYTES})`);
  }
  return json;
}

// ---- Cookie helpers ----
export function parseCookieHeader(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(";");
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readOverridesFromCookieHeader(cookieHeader?: string): Overrides {
  const jar = parseCookieHeader(cookieHeader);
  const raw = jar["sv_flags_override"];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return OverridesSchema.parse(parsed);
  } catch {
    return {};
  }
}

/** Запретить dotted‑path ключи (prod) — или разрешить в dev по ALLOW_DOTTED_OVERRIDE. */
export function filterDottedPaths(overrides: OverrideDiff): OverrideDiff {
  const allowDotted =
    process.env.ALLOW_DOTTED_OVERRIDE === "true" && process.env.NODE_ENV !== "production";
  if (allowDotted) return overrides;
  const out: OverrideDiff = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (k.includes(".") || k.includes("[")) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Проверка типов override согласно реестру флагов. */
export function validateOverrideTypes(
  overrides: OverrideDiff,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const [name, val] of Object.entries(overrides)) {
    if (!isKnownFlag(name)) {
      continue;
    }
    if (val === null) {
      continue;
    }
    const meta = FLAG_REGISTRY[name];
    switch (meta.type) {
      case "boolean":
        if (typeof val !== "boolean") errors.push(`${name} must be boolean`);
        break;
      case "string":
        if (typeof val !== "string") errors.push(`${name} must be string`);
        else if (val.length > MAX_STRING_LEN) errors.push(`${name} string too long`);
        break;
      case "number":
        if (typeof val !== "number" || !Number.isFinite(val)) errors.push(`${name} must be number`);
        else if (val < MIN_NUMBER || val > MAX_NUMBER) errors.push(`${name} number out of range`);
        break;
      case "rollout":
        if (typeof val !== "boolean") errors.push(`${name} rollout override must be boolean`);
        break;
      case "variant": {
        if (typeof val !== "string") {
          errors.push(`${name} variant override must be string`);
        } else {
          const variants = getVariantNames(meta.defaultValue);
          if (!Object.prototype.hasOwnProperty.call(variants, val)) {
            errors.push(`${name} unknown variant "${val}"`);
          }
        }
        break;
      }
      default:
        errors.push(`${name} has unsupported type`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
function getVariantNames(config: unknown): Record<string, number> {
  if (
    typeof config === "object" &&
    config !== null &&
    "variants" in config &&
    typeof (config as { variants?: unknown }).variants === "object" &&
    (config as { variants?: unknown }).variants !== null
  ) {
    return (config as VariantConfig).variants ?? {};
  }
  return {};
}
