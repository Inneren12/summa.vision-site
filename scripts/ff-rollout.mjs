#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { exit } from "node:process";

const HELP = `Usage: node scripts/ff-rollout.mjs --policy=<file> (--dry-run|--apply)\n`;

function parseArgs() {
  const out = { policy: undefined, mode: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      exit(0);
    }
    if (arg === "--apply") {
      if (out.mode && out.mode !== "apply") {
        throw new Error("Specify only one of --dry-run or --apply");
      }
      out.mode = "apply";
      continue;
    }
    if (arg === "--dry-run") {
      if (out.mode && out.mode !== "dry-run") {
        throw new Error("Specify only one of --dry-run or --apply");
      }
      out.mode = "dry-run";
      continue;
    }
    if (arg.startsWith("--policy=")) {
      out.policy = arg.slice("--policy=".length);
      continue;
    }
    console.warn(`Unknown argument: ${arg}`);
  }
  if (!out.policy) {
    throw new Error("--policy is required");
  }
  if (!out.mode) {
    throw new Error("Either --dry-run or --apply must be provided");
  }
  return out;
}

function ensureString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function ensurePercent(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`${name} must be between 0 and 100`);
  }
  return value;
}

function optionalNumber(value, name, { min, max, integer } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${name} must be >= ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${name} must be <= ${max}`);
  }
  return value;
}

function sanitizeStop(stop) {
  if (!stop || typeof stop !== "object") return undefined;
  const out = {};
  if (typeof stop.maxErrorRate === "number") {
    out.maxErrorRate = optionalNumber(stop.maxErrorRate, "policy.stop.maxErrorRate", {
      min: 0,
      max: 1,
    });
  }
  if (typeof stop.maxCLS === "number") {
    out.maxCLS = optionalNumber(stop.maxCLS, "policy.stop.maxCLS", { min: 0 });
  }
  if (typeof stop.maxINP === "number") {
    out.maxINP = optionalNumber(stop.maxINP, "policy.stop.maxINP", { min: 0 });
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeHysteresis(hysteresis) {
  if (!hysteresis || typeof hysteresis !== "object") return undefined;
  const out = {};
  if (typeof hysteresis.errorRate === "number") {
    out.errorRate = optionalNumber(hysteresis.errorRate, "policy.hysteresis.errorRate", {
      min: 0,
      max: 1,
    });
  }
  const cls =
    typeof hysteresis.CLS === "number"
      ? hysteresis.CLS
      : typeof hysteresis.cls === "number"
        ? hysteresis.cls
        : undefined;
  if (cls !== undefined) {
    out.CLS = optionalNumber(cls, "policy.hysteresis.CLS", { min: 0 });
  }
  const inp =
    typeof hysteresis.INP === "number"
      ? hysteresis.INP
      : typeof hysteresis.inp === "number"
        ? hysteresis.inp
        : undefined;
  if (inp !== undefined) {
    out.INP = optionalNumber(inp, "policy.hysteresis.INP", { min: 0 });
  }
  return Object.keys(out).length ? out : undefined;
}

async function loadPolicy(path) {
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);
  const host = ensureString(json.host ?? "http://localhost:3000", "policy.host");
  const flag = ensureString(json.flag, "policy.flag");
  const namespace = json.ns ? ensureString(json.ns, "policy.ns") : undefined;
  const stepsInput = Array.isArray(json.steps) ? json.steps : [];
  if (stepsInput.length === 0) {
    throw new Error("policy.steps must be a non-empty array");
  }
  const steps = [
    ...new Set(stepsInput.map((value, idx) => ensurePercent(value, `policy.steps[${idx}]`))),
  ].sort((a, b) => a - b);
  const stop = sanitizeStop(json.stop);
  const minSamples = optionalNumber(json.minSamples, "policy.minSamples", {
    min: 0,
    integer: true,
  });
  const coolDownMs = optionalNumber(json.coolDownMs, "policy.coolDownMs", {
    min: 0,
    integer: true,
  });
  const hysteresis = sanitizeHysteresis(json.hysteresis);
  const shadow =
    typeof json.shadow === "boolean"
      ? json.shadow
      : typeof json.shadow === "string"
        ? json.shadow.toLowerCase() === "true"
        : undefined;
  const token = typeof json.token === "string" && json.token.trim() ? json.token.trim() : undefined;
  return { host, flag, namespace, steps, stop, minSamples, coolDownMs, hysteresis, token, shadow };
}

function resolveToken(policyToken) {
  if (policyToken) return policyToken;
  if (process.env.ADMIN_TOKEN_OPS) return process.env.ADMIN_TOKEN_OPS;
  if (process.env.FF_ADMIN_TOKEN) return process.env.FF_ADMIN_TOKEN;
  if (process.env.FF_CONSOLE_OPS_TOKENS) {
    const [first] = process.env.FF_CONSOLE_OPS_TOKENS.split(/[\s,]+/).filter(Boolean);
    if (first) return first;
  }
  return undefined;
}

function buildHeaders(token, hasBody) {
  const headers = {};
  if (hasBody) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  return headers;
}

async function fetchFlag(host, token, key) {
  const url = new URL(`/api/flags/${encodeURIComponent(key)}`, host);
  const res = await fetch(url, { headers: buildHeaders(token, false) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load flag ${key}: ${res.status} ${text}`);
  }
  return res.json();
}

function nextRolloutStep(current, steps) {
  for (const step of steps) {
    if (step > current + 1e-6) return step;
  }
  return null;
}

function describeImpact(current, target) {
  const delta = target - current;
  return `Global rollout: ${current.toFixed(2)}% → ${target.toFixed(2)}% (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%)`;
}

function printMetrics(metrics) {
  if (!metrics) return;
  const parts = [`denom=${metrics.denominator ?? 0}`];
  if (typeof metrics.errorRate === "number") {
    parts.push(`er=${metrics.errorRate.toFixed(4)}`);
  }
  if (typeof metrics.cls === "number") {
    parts.push(`cls=${metrics.cls.toFixed(3)}`);
  }
  if (typeof metrics.inp === "number") {
    parts.push(`inp=${metrics.inp.toFixed(2)}`);
  }
  console.log(`  metrics: ${parts.join(", ")}`);
}

function compactPayload(payload) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
      } else if (Object.keys(value).length === 0) {
        continue;
      }
    }
    out[key] = value;
  }
  return out;
}

async function postStep(host, token, key, payload) {
  const url = new URL(`/api/flags/${encodeURIComponent(key)}/rollout/step`, host);
  const body = JSON.stringify(compactPayload(payload));
  const res = await fetch(url, { method: "POST", headers: buildHeaders(token, true), body });
  const text = await res.text().catch(() => "");
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function main() {
  try {
    const args = parseArgs();
    const policy = await loadPolicy(args.policy);
    const token = resolveToken(policy.token);
    if (!token) {
      console.warn("Warning: no admin token resolved; request may fail with 401");
    }
    console.log(`Loaded policy for ${policy.flag} targeting ${policy.host}`);
    const flagResponse = await fetchFlag(policy.host, token, policy.flag);
    const flag = flagResponse.flag ?? {};
    const currentPct =
      Number(flag.rollout?.currentPct ?? flag.rollout?.steps?.at?.(-1)?.pct ?? 0) || 0;
    const nextPct = nextRolloutStep(currentPct, policy.steps);
    if (nextPct === null) {
      console.log("No further rollout steps available (already at final step).");
      return;
    }
    console.log(`Current rollout: ${currentPct.toFixed(2)}%`);
    console.log(`Next step: ${nextPct.toFixed(2)}%${policy.shadow ? " (shadow)" : ""}`);
    console.log(`  ${describeImpact(currentPct, nextPct)}`);

    const payload = {
      namespace: policy.namespace,
      nextPct,
      stop: policy.stop,
      minSamples: policy.minSamples,
      coolDownMs: policy.coolDownMs,
      hysteresis: policy.hysteresis,
      dryRun: args.mode === "dry-run",
      shadow: typeof policy.shadow === "boolean" ? policy.shadow : undefined,
    };

    const { status, body } = await postStep(policy.host, token, policy.flag, payload);

    if (args.mode === "dry-run") {
      const decision = body.decision ?? (body.ok ? "advance" : "hold");
      console.log(`Dry-run decision: ${decision.toUpperCase()} (status ${body.status ?? status})`);
      if (body.reason) {
        console.log(`  reason: ${body.reason}`);
      }
      if (typeof body.limit === "number") {
        console.log(`  limit: ${body.limit}`);
      }
      if (typeof body.actual === "number") {
        console.log(`  actual: ${body.actual}`);
      }
      if (typeof body.retryInMs === "number") {
        console.log(`  retry in: ${(body.retryInMs / 1000).toFixed(1)}s`);
      }
      if (body.shadowCoverage !== undefined) {
        console.log(`  shadow coverage: ${body.shadowCoverage.toFixed(2)}%`);
      }
      if (body.metrics) {
        printMetrics(body.metrics);
      }
      return;
    }

    if (status === 200) {
      console.log(`Apply succeeded (${status}).`);
      if (body.rollout?.currentPct !== undefined) {
        console.log(`  rollout now: ${body.rollout.currentPct}%`);
      }
      if (body.rollout?.shadow !== undefined) {
        console.log(`  shadow: ${body.rollout.shadow ? "enabled" : "disabled"}`);
      }
      if (body.metrics) {
        printMetrics(body.metrics);
      }
      return;
    }

    console.log(`Apply HOLD (${status}).`);
    if (body.error || body.reason) {
      console.log(`  error: ${body.error ?? ""}`.trim());
      console.log(`  reason: ${body.reason}`);
    }
    if (typeof body.limit === "number") {
      console.log(`  limit: ${body.limit}`);
    }
    if (typeof body.actual === "number") {
      console.log(`  actual: ${body.actual}`);
    }
    if (typeof body.retryInMs === "number") {
      console.log(`  retry in: ${(body.retryInMs / 1000).toFixed(1)}s`);
    }
    if (body.metrics) {
      printMetrics(body.metrics);
    }
    exit(status === 200 ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exit(1);
  }
}

main();
