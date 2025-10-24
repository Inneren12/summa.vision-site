#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { exit } from "node:process";

const HELP = `Usage: node scripts/ff-rollout.mjs --policy=<file> [--apply]\n`;

function parseArgs() {
  const out = { policy: undefined, apply: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      exit(0);
    }
    if (arg === "--apply") {
      out.apply = true;
      continue;
    }
    if (arg.startsWith("--policy=")) {
      out.policy = arg.slice("--policy=".length);
      continue;
    }
    console.warn(`Unknown argument: ${arg}`);
  }
  if (!out.policy) {
    console.error("--policy is required");
    console.log(HELP);
    exit(1);
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

async function loadPolicy(path) {
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);
  const host = ensureString(json.host ?? "http://localhost:3000", "policy.host");
  const steps = Array.isArray(json.steps) ? json.steps : [];
  if (steps.length === 0) {
    throw new Error("policy.steps must be a non-empty array");
  }
  const token = typeof json.token === "string" && json.token.trim() ? json.token.trim() : undefined;
  const parsedSteps = steps.map((step, idx) => {
    const flag = ensureString(step.flag, `policy.steps[${idx}].flag`);
    const namespace = step.namespace
      ? ensureString(step.namespace, `policy.steps[${idx}].namespace`)
      : undefined;
    const nextPct = ensurePercent(step.nextPct, `policy.steps[${idx}].nextPct`);
    const stop =
      typeof step.stop === "object" && step.stop
        ? {
            maxErrorRate:
              typeof step.stop.maxErrorRate === "number" ? step.stop.maxErrorRate : undefined,
            maxCLS: typeof step.stop.maxCLS === "number" ? step.stop.maxCLS : undefined,
            maxINP: typeof step.stop.maxINP === "number" ? step.stop.maxINP : undefined,
          }
        : undefined;
    return { flag, namespace, nextPct, stop };
  });
  return { host, steps: parsedSteps, token };
}

async function applyStep(host, token, step) {
  const url = new URL(`/api/flags/${encodeURIComponent(step.flag)}/rollout/step`, host);
  const headers = { "content-type": "application/json" };
  if (token) {
    headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  } else if (process.env.FF_ADMIN_TOKEN) {
    headers.authorization = `Bearer ${process.env.FF_ADMIN_TOKEN}`;
  }
  const body = JSON.stringify({
    namespace: step.namespace,
    nextPct: step.nextPct,
    stop: step.stop,
  });
  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed for ${step.flag}: ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}

async function main() {
  const args = parseArgs();
  const policy = await loadPolicy(args.policy);
  console.log(`Loaded rollout policy with ${policy.steps.length} step(s) targeting ${policy.host}`);
  for (const step of policy.steps) {
    console.log(
      `• ${step.flag} → ${step.nextPct}%${step.namespace ? ` (ns: ${step.namespace})` : ""}`,
    );
    if (step.stop) {
      console.log(`  stop conditions: ${JSON.stringify(step.stop)}`);
    }
    if (args.apply) {
      const result = await applyStep(policy.host, policy.token, step);
      console.log(`  applied: ${JSON.stringify(result)}`);
    } else {
      console.log("  (dry-run)");
    }
  }
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
