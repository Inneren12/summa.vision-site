import fs from "node:fs";
import path from "node:path";

import { FLAG_REGISTRY } from "../lib/ff/flags.js";

const names = Object.keys(FLAG_REGISTRY);
const out = [];
out.push("// AUTO-GENERATED. Do not edit.");
out.push(`import type { EffectiveValueFor } from "../lib/ff/flags";`);
out.push("");
out.push("// Map of effective types: name -> return type of useFlag(name)");
out.push("export interface GeneratedFlagTypeMap {");
const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
for (const n of names) {
  const literal = JSON.stringify(n);
  const key = IDENT_RE.test(n) ? n : literal;
  out.push(`  ${key}: EffectiveValueFor<${literal}>;`);
}
out.push("}");
out.push("export type GeneratedFlagName = keyof GeneratedFlagTypeMap;");
out.push("");
fs.mkdirSync("types", { recursive: true });
fs.writeFileSync(path.join("types", "flags.generated.d.ts"), out.join("\n"), "utf8");

// Also write JSON with names for ff-doctor (no TS import needed)
fs.mkdirSync("generated", { recursive: true });
fs.writeFileSync(
  path.join("generated", "flags.names.json"),
  `{ "names": [${names.map((n) => JSON.stringify(n)).join(", ")}] }\n`,
  "utf8",
);

const md = [
  "# Flags Inventory",
  "",
  "| name | type | owner | deprecated | sunset | description |",
  "|---|---|---|---|---|---|",
];
for (const [n, m] of Object.entries(FLAG_REGISTRY)) {
  md.push(
    `| ${n} | ${m.type} | ${m.owner ?? ""} | ${m.deprecated ? "yes" : ""} | ${
      m.sunsetDate ?? ""
    } | ${m.description ?? ""} |`,
  );
}
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/flags.generated.md", md.join("\n"), "utf8");
