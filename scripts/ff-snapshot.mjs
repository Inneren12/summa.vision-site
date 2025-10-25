#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { exit, stdin, stdout } from "node:process";
import readline from "node:readline";

const HELP = `Usage: node scripts/ff-snapshot.mjs <export|restore> <file> [--host=http://localhost:3000] [--token=...] [--yes]\n`;

function parseArgs(argv) {
  const args = { mode: null, file: null, host: null, token: null, yes: false };
  const positional = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      exit(0);
    }
    if (arg.startsWith("--host=")) {
      args.host = arg.slice("--host=".length);
      continue;
    }
    if (arg.startsWith("--token=")) {
      args.token = arg.slice("--token=".length);
      continue;
    }
    if (arg === "--yes" || arg === "-y" || arg === "--force") {
      args.yes = true;
      continue;
    }
    positional.push(arg);
  }
  if (positional.length > 0) {
    args.mode = positional[0];
  }
  if (positional.length > 1) {
    args.file = positional[1];
  }
  return args;
}

function resolveHost(argHost) {
  if (argHost) return argHost;
  if (process.env.FF_SNAPSHOT_HOST) return process.env.FF_SNAPSHOT_HOST;
  if (process.env.FF_CONSOLE_HOST) return process.env.FF_CONSOLE_HOST;
  return "http://localhost:3000";
}

function resolveToken(argToken) {
  if (argToken) return argToken;
  if (process.env.FF_SNAPSHOT_TOKEN) return process.env.FF_SNAPSHOT_TOKEN;
  if (process.env.ADMIN_TOKEN_OPS) return process.env.ADMIN_TOKEN_OPS;
  if (process.env.FF_CONSOLE_OPS_TOKENS) {
    const [first] = process.env.FF_CONSOLE_OPS_TOKENS.split(/[\s,]+/).filter(Boolean);
    if (first) return first;
  }
  if (process.env.FF_ADMIN_TOKEN) return process.env.FF_ADMIN_TOKEN;
  return null;
}

function buildHeaders(token, hasBody) {
  const headers = {};
  if (hasBody) headers["content-type"] = "application/json";
  if (token) headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return headers;
}

async function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

async function exportSnapshot(file, host, token) {
  const target = path.resolve(file);
  const url = new URL("/ops/snapshot", host);
  const res = await fetch(url, { headers: buildHeaders(token, false) });
  if (res.status === 404) {
    console.error(`[ff-snapshot] /ops/snapshot not available on ${host}`);
    exit(2);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[ff-snapshot] Failed to fetch snapshot: ${res.status} ${text}`);
    exit(1);
  }
  const data = await res.json();
  const pretty = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(target, pretty, "utf8");
  const flags = Array.isArray(data?.flags) ? data.flags.length : 0;
  const overrides = Array.isArray(data?.overrides) ? data.overrides.length : 0;
  console.log(`[ff-snapshot] Saved ${flags} flags and ${overrides} overrides → ${target}`);
}

async function restoreSnapshot(file, host, token, yes) {
  const target = path.resolve(file);
  const raw = await readFile(target, "utf8").catch((error) => {
    if (error && error.code === "ENOENT") {
      console.error(`[ff-snapshot] File not found: ${target}`);
      exit(1);
    }
    throw error;
  });
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    console.error(`[ff-snapshot] ${target} is not valid JSON`);
    exit(1);
  }
  const flags = Array.isArray(payload?.flags) ? payload.flags.length : 0;
  const overrides = Array.isArray(payload?.overrides) ? payload.overrides.length : 0;
  if (!yes) {
    const proceed = await confirm(
      `[ff-snapshot] Restore ${flags} flags and ${overrides} overrides to ${host}? (yes/no) `,
    );
    if (!proceed) {
      console.log("[ff-snapshot] Aborted by user");
      exit(0);
    }
  }
  const url = new URL("/ops/restore", host);
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(token, true),
    body: JSON.stringify(payload),
  });
  if (res.status === 404) {
    console.error(`[ff-snapshot] /ops/restore not available on ${host}`);
    exit(2);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[ff-snapshot] Restore failed: ${res.status} ${text}`);
    exit(1);
  }
  const result = await res.json().catch(() => ({}));
  const appliedFlags = result?.flags ?? flags;
  const appliedOverrides = result?.overrides ?? overrides;
  console.log(
    `[ff-snapshot] Restore succeeded: ${appliedFlags} flags, ${appliedOverrides} overrides (${host})`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.mode || !args.file) {
    console.error(HELP);
    exit(1);
  }
  const host = resolveHost(args.host);
  const token = resolveToken(args.token);
  if (!token) {
    console.warn(
      "[ff-snapshot] Warning: no token provided. Set --token=... or FF_CONSOLE_OPS_TOKENS/ADMIN_TOKEN_OPS for authenticated environments.",
    );
  }
  if (args.mode === "export") {
    await exportSnapshot(args.file, host, token);
    return;
  }
  if (args.mode === "restore") {
    await restoreSnapshot(args.file, host, token, args.yes);
    return;
  }
  console.error(`[ff-snapshot] Unknown mode: ${args.mode}`);
  console.error(HELP);
  exit(1);
}

main().catch((error) => {
  console.error("[ff-snapshot] Unexpected error", error);
  exit(1);
});
