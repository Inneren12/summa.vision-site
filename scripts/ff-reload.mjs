#!/usr/bin/env node

const HELP = `Usage: node scripts/ff-reload.mjs [--host=http://localhost:3000]\n`;

function parseArgs(argv) {
  const args = { host: null };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (arg.startsWith("--host=")) {
      args.host = arg.slice("--host=".length);
    }
  }
  return args;
}

function resolveHost(argHost) {
  if (argHost) return argHost;
  if (process.env.FF_DEV_HOST) return process.env.FF_DEV_HOST;
  if (process.env.FF_SNAPSHOT_HOST) return process.env.FF_SNAPSHOT_HOST;
  if (process.env.FF_CONSOLE_HOST) return process.env.FF_CONSOLE_HOST;
  return "http://localhost:3000";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = resolveHost(args.host);
  const url = new URL("/api/dev/ff-reload", host);
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[ff-reload] Failed: ${res.status} ${text}`);
    process.exit(1);
  }
  console.log(`[ff-reload] OK → ${host}`);
}

main().catch((error) => {
  console.error("[ff-reload] Unexpected error", error);
  process.exit(1);
});
