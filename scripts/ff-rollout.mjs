#!/usr/bin/env node

import { argv, exit } from "node:process";

const HELP = `Usage: node scripts/ff-rollout.mjs --flag=<name> [--step=5] [--host=http://localhost:3000] [--apply]\n`;

function parseArgs() {
  const out = { flag: undefined, step: 5, host: "http://localhost:3000", apply: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      exit(0);
    }
    if (arg === "--apply") {
      out.apply = true;
      continue;
    }
    if (arg.startsWith("--flag=")) {
      out.flag = arg.slice("--flag=".length);
      continue;
    }
    if (arg.startsWith("--step=")) {
      out.step = Number(arg.slice("--step=".length));
      continue;
    }
    if (arg.startsWith("--host=")) {
      out.host = arg.slice("--host=".length);
      continue;
    }
    console.warn(`Unknown argument: ${arg}`);
  }
  if (!out.flag) {
    console.error("--flag is required");
    console.log(HELP);
    exit(1);
  }
  if (!Number.isFinite(out.step)) {
    console.error("--step must be a number");
    exit(1);
  }
  return out;
}

async function main() {
  const { flag, step, host, apply } = parseArgs();
  const url = new URL(`/api/flags/${encodeURIComponent(flag)}/rollout/step`, host);
  if (!apply) {
    console.log(`[dry-run] Would step flag "${flag}" by ${step}`);
    console.log(`POST ${url}`);
    exit(0);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ step }),
  });
  if (!res.ok) {
    console.error(`Request failed: ${res.status}`);
    try {
      console.error(await res.text());
    } catch {
      /* noop */
    }
    exit(1);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
