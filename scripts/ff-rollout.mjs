#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { exit } from "node:process";

import {
  parseRolloutPolicy,
  RolloutPolicyValidationError,
  formatRolloutPolicyIssues,
} from "../lib/ff/policy/schema.mjs";

const HELP = `Usage: node scripts/ff-rollout.mjs --policy=<file> (--dry-run|--apply)\n`;

function parseArgs() {
  const out = { policy: undefined, mode: null, shadow: undefined };
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
    if (arg === "--shadow") {
      out.shadow = true;
      continue;
    }
    if (arg === "--no-shadow") {
      out.shadow = false;
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

async function loadPolicy(path) {
  const raw = await readFile(path, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse policy JSON: ${(error && error.message) || error}`);
  }
  try {
    const policy = parseRolloutPolicy(json);
    return { ...policy, namespace: policy.ns };
  } catch (error) {
    if (error instanceof RolloutPolicyValidationError) {
      throw new Error(`Policy validation failed:\n${formatRolloutPolicyIssues(error.issues)}`);
    }
    throw error;
  }
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
    if (typeof args.shadow === "boolean") {
      policy.shadow = args.shadow;
    }
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
