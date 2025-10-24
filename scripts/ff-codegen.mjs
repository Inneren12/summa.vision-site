import fs from "node:fs";
import path from "node:path";

import { getRegistryAndNames } from "./codegen/extract-registry.js";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function emitTypes(names) {
  const out = [];
  out.push("// AUTO-GENERATED. Do not edit.");
  out.push(`import type { EffectiveValueFor } from "../lib/ff/flags";`);
  out.push("");
  out.push("// Map of effective types: flag name -> return type of useFlag(name)");
  out.push("export interface GeneratedFlagTypeMap {");
  const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
  for (const n of names) {
    const literal = JSON.stringify(n);
    const key = IDENT_RE.test(n) ? n : literal;
    out.push(`  ${key}: EffectiveValueFor<${literal}>;`);
  }
  out.push("}");
  out.push("export type GeneratedFlagName = keyof GeneratedFlagTypeMap;");
  ensureDir("types");
  fs.writeFileSync(path.join("types", "flags.generated.d.ts"), `${out.join("\n")}\n`, "utf8");
}

function emitDocs(registry, names) {
  const rows = [
    "# Flags Inventory",
    "",
    "| name | type | owner | deprecated | sunset | description |",
    "|---|---|---|---|---|---|",
  ];
  if (registry) {
    for (const n of names) {
      const m = registry[n] || {};
      rows.push(
        `| ${n} | ${m.type ?? ""} | ${m.owner ?? ""} | ${m.deprecated ? "yes" : ""} | ${m.sunsetDate ?? ""} | ${m.description ?? ""} |`,
      );
    }
  } else {
    for (const n of names) rows.push(`| ${n} |  |  |  |  |  |`);
  }
  ensureDir("docs");
  fs.writeFileSync(path.join("docs", "flags.generated.md"), `${rows.join("\n")}\n`, "utf8");
}

function emitNamesJson(names) {
  ensureDir("generated");
  const arr = names.map((n) => JSON.stringify(n)).join(", ");
  const body = `{
  "names": [${arr}]
}\n`;
  fs.writeFileSync(path.join("generated", "flags.names.json"), body, "utf8");
}

function main() {
  const { registry, names } = getRegistryAndNames();
  if (!Array.isArray(names) || names.length === 0) {
    console.error(
      "[ff-codegen] No flag names found. Ensure lib/ff/flags.ts has FlagName union or registry.",
    );
    process.exit(1);
  }
  emitTypes(names);
  emitDocs(registry, names);
  emitNamesJson(names);
  console.log(`[ff-codegen] Generated ${names.length} flags → types/, docs/, generated/`);
}

main();
