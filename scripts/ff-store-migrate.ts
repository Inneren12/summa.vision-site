#!/usr/bin/env tsx

import path from "node:path";
import { argv, exit } from "node:process";

import { FF } from "../lib/ff/runtime";
import { writeSnapshotToFile } from "../lib/ff/runtime/snapshot";

function parseArgs() {
  const out: { file: string } = { file: path.resolve(".runtime", "flags.snapshot.json") };
  for (const arg of argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: tsx scripts/ff-store-migrate.ts [--file=./.runtime/flags.snapshot.json]");
      exit(0);
    }
    if (arg.startsWith("--file=")) {
      out.file = path.resolve(arg.slice("--file=".length));
      continue;
    }
    console.warn(`Unknown argument: ${arg}`);
  }
  return out;
}

async function main() {
  if (process.env.FF_STORE_ADAPTER && process.env.FF_STORE_ADAPTER !== "memory") {
    console.warn("FF_STORE_ADAPTER is set. Migration expects the in-memory store.");
  }
  const { file } = parseArgs();
  const snapshot = await FF().snapshot();
  writeSnapshotToFile(snapshot.data, file);
  console.log(`Snapshot written to ${file}`);
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
