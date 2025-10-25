import fs from "node:fs";
import path from "node:path";

import { getRegistryAndNames } from "./codegen/extract-registry.js";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeSingleQuotes(name) {
  return name.replace(/'/g, "\\'");
}

function formatFlagUnion(names) {
  if (!names.length) {
    return "export type FlagKey = never;";
  }
  const lines = [
    "export type FlagKey =",
    ...names.map((name) => `  | '${escapeSingleQuotes(String(name))}'`),
  ];
  lines[lines.length - 1] += ";";
  return lines.join("\n");
}

function main() {
  const { names } = getRegistryAndNames();
  if (!Array.isArray(names) || names.length === 0) {
    console.error("[ff-types] No flag names found. Run ff:codegen first or check registry.");
    process.exit(1);
  }
  const body = ["// AUTO-GENERATED. Do not edit.", formatFlagUnion(names), ""];
  ensureDir("types");
  fs.writeFileSync(path.join("types", "flags.d.ts"), body.join("\n"), "utf8");
  console.log(`[ff-types] Generated type union for ${names.length} flag keys.`);
}

main();
