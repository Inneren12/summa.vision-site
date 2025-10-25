#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { FlagConfigListSchema } from "../lib/ff/schema.ts";

const HELP = `Usage: npm run ff:validate [-- --file=flags.json]

Options:
  --file=<path>   Validate flags from a JSON file (array or snapshot with {"flags": []}).
  --quiet         Only print validation errors.
  -h, --help      Show this message.
`;

function parseArgs(argv) {
  const options = { file: null, quiet: false, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }
    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (arg.startsWith("--file=")) {
      options.file = arg.slice("--file=".length);
      continue;
    }
    if (!arg.startsWith("--") && !options.file) {
      options.file = arg;
    }
  }
  return options;
}

async function loadFlagsFromFile(filePath) {
  const target = path.resolve(filePath);
  let raw;
  try {
    raw = await readFile(target, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`[ff-validate] File not found: ${target}`);
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `[ff-validate] ${target} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.flags)) {
    return parsed.flags;
  }
  throw new Error(
    `[ff-validate] ${target} must be a JSON array of flags or an object with a "flags" array.`,
  );
}

async function loadFlagsFromStore() {
  const adapter = (process.env.FF_STORE_ADAPTER || "file").toLowerCase();
  if (adapter === "file") {
    const file = process.env.FF_STORE_FILE || path.resolve(".runtime", "flags.snapshot.json");
    try {
      return await loadFlagsFromFile(file);
    } catch (error) {
      if (error instanceof Error && /File not found/.test(error.message)) {
        return [];
      }
      throw error;
    }
  }
  if (adapter === "memory") {
    const { MemoryFlagStore } = await import("../lib/ff/runtime/memory-store.ts");
    const store = new MemoryFlagStore();
    return store.listFlags();
  }
  if (adapter === "redis") {
    try {
      const { resolveStoreAdapter } = await import("../lib/ff/runtime/store-resolver.ts");
      const { store } = resolveStoreAdapter();
      return store.listFlags();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[ff-validate] Failed to load Redis store: ${message}`);
    }
  }
  throw new Error(
    `[ff-validate] Unknown FF_STORE_ADAPTER "${process.env.FF_STORE_ADAPTER}". Expected file, memory or redis.`,
  );
}

function formatPath(path) {
  if (!path || path.length === 0) return "flags";
  let acc = "flags";
  for (const segment of path) {
    if (typeof segment === "number") {
      acc += `[${segment}]`;
    } else {
      const needsDot = acc.length > 0 && !acc.endsWith("[");
      acc += `${needsDot ? "." : ""}${segment}`;
    }
  }
  return acc;
}

function reportIssues(issues) {
  console.error(`[ff-validate] Validation failed with ${issues.length} error(s):`);
  for (const issue of issues) {
    const location = formatPath(issue.path);
    console.error(`  - ${location}: ${issue.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP.trimEnd());
    return;
  }

  try {
    const flags = args.file ? await loadFlagsFromFile(args.file) : await loadFlagsFromStore();
    const result = FlagConfigListSchema.safeParse(flags);
    if (!result.success) {
      reportIssues(result.error.issues);
      process.exitCode = 1;
      return;
    }
    if (!args.quiet) {
      console.log(`[ff-validate] OK: ${result.data.length} flag(s) validated`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

await main();
