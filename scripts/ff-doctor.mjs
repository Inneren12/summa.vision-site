import fs from "node:fs";
import path from "node:path";

import { stripComments } from "./utils/strip-comments.js";

const ROOT = path.resolve(process.cwd());
const SRC = ["app", "components", "lib"];
const NAMES_FILE = path.join(ROOT, "generated", "flags.names.json");
let flagNames = [];
try {
  const json = JSON.parse(fs.readFileSync(NAMES_FILE, "utf8"));
  if (Array.isArray(json?.names)) flagNames = json.names;
} catch {
  // ignore missing names file; handled by warning below
}
if (!flagNames.length) {
  console.error("[ff-doctor] No flag names. Run: npm run ff:codegen");
  process.exit(2);
}

const refs = new Map(flagNames.map((n) => [n, 0]));
const unknown = new Map();
const known = new Set(flagNames);

function readFiles(dir) {
  const acc = [];
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((ent) => {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) return walk(p);
      if (/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) acc.push(p);
    });
  walk(dir);
  return acc;
}

const files = SRC.flatMap((p) => readFiles(path.join(ROOT, p)));

// Паттерны реального использования флагов
const usagePatterns = [
  /useFlag\(\s*(['"])([a-zA-Z0-9_-]+)\1\s*\)/g,
  /<FlagGate(?:Server|Client)?\b[^>]*\bname=(['"])([a-zA-Z0-9_-]+)\1/g,
  /<PercentGate(?:Server|Client)?\b[^>]*\bname=(['"])([a-zA-Z0-9_-]+)\1/g,
  /<VariantGate(?:Server|Client)?\b[^>]*\bname=(['"])([a-zA-Z0-9_-]+)\1/g,
  /<FlagGate(?:Server|Client)?\b[^>]*\bname=\{\s*(['"])([a-zA-Z0-9_-]+)\1\s*\}/g,
  /<PercentGate(?:Server|Client)?\b[^>]*\bname=\{\s*(['"])([a-zA-Z0-9_-]+)\1\s*\}/g,
  /<VariantGate(?:Server|Client)?\b[^>]*\bname=\{\s*(['"])([a-zA-Z0-9_-]+)\1\s*\}/g,
  /\?ff=([a-zA-Z0-9_-]+)\s*:/g,
];

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const text = stripComments(raw);
  for (const patt of usagePatterns) {
    const re = new RegExp(patt.source, patt.flags);
    for (const m of text.matchAll(re)) {
      const name = m[2] || m[1];
      if (!name) continue;
      if (known.has(name)) {
        refs.set(name, (refs.get(name) || 0) + 1);
      } else {
        unknown.set(name, (unknown.get(name) || 0) + 1);
      }
    }
  }
}

const errors = [];
const warnings = [];
// Здесь проверяем только presence/unknown — метаданные валидируются рантаймом/юнитами.
for (const n of flagNames) {
  if ((refs.get(n) || 0) === 0) warnings.push(`${n}: unused`);
}
for (const [n, count] of unknown.entries()) {
  errors.push(`unknown flag usage "${n}" (${count} refs)`);
}

if (errors.length) {
  console.error("[ff-doctor] Errors:");
  for (const e of errors) console.error("  -", e);
}
if (warnings.length) {
  console.warn("[ff-doctor] Warnings:");
  for (const w of warnings) console.warn("  -", w);
}
if (errors.length) process.exit(1);
process.exit(0);
