import fs from "node:fs";
import path from "node:path";

import { scanTextForFlags } from "./doctor/scan.js";

const ROOT = path.resolve(process.cwd());
const SRC_DIRS = ["app", "components", "lib"];
const NAMES_JSON = path.join(ROOT, "generated", "flags.names.json");
const TS_FLAGS = path.join(ROOT, "lib", "ff", "flags.ts");
const ALLOW_FILE = path.join(ROOT, "scripts", "ff-doctor.allow"); // optional

function readFlagNames() {
  // 1) JSON из codegen (предпочтительно)
  try {
    const j = JSON.parse(fs.readFileSync(NAMES_JSON, "utf8"));
    if (Array.isArray(j?.names) && j.names.length) return j.names;
  } catch {
    // ignore and fallback to TypeScript source
  }
  // 2) Fallback: парсим union из lib/ff/flags.ts
  try {
    const src = fs.readFileSync(TS_FLAGS, "utf8");
    const m = src.match(/export\s+type\s+FlagName\s*=\s*([^;]+);/m);
    if (m) {
      const body = m[1];
      const names = Array.from(body.matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)).map((x) => x[1]);
      if (names.length) {
        console.warn(
          "[ff-doctor] fallback: parsed names from lib/ff/flags.ts (run ff:codegen to speed up)",
        );
        return names;
      }
    }
  } catch {
    // ignore and report below
  }
  console.error("[ff-doctor] No flag names available. Run: npm run ff:codegen");
  process.exit(2);
}

function readAllowList() {
  const allow = { use: new Set(), allowUnknown: new Set() };
  if (!fs.existsSync(ALLOW_FILE)) return allow;
  const lines = fs.readFileSync(ALLOW_FILE, "utf8").split(/\r?\n/);
  for (const ln of lines) {
    const s = ln.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^(use|allow-unknown)\s*:\s*([a-zA-Z0-9_-]+)$/);
    if (!m) continue;
    const [, kind, name] = m;
    if (kind === "use") allow.use.add(name);
    else allow.allowUnknown.add(name);
  }
  return allow;
}

function readFiles() {
  const acc = [];
  for (const dir of SRC_DIRS) {
    const root = path.join(ROOT, dir);
    if (!fs.existsSync(root)) continue;
    const walk = (d) =>
      fs.readdirSync(d, { withFileTypes: true }).forEach((ent) => {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) return walk(p);
        if (/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) acc.push(p);
      });
    walk(root);
  }
  return acc;
}

const flagNames = readFlagNames();
const allow = readAllowList();
const files = readFiles();

const refs = new Map(flagNames.map((n) => [n, 0]));
const unknown = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const r = scanTextForFlags(text, flagNames);
  for (const [k, v] of r.refs) refs.set(k, (refs.get(k) || 0) + v);
  for (const [k, v] of r.unknown) unknown.set(k, (unknown.get(k) || 0) + v);
}

// Применяем allow-лист
for (const name of allow.use) {
  if (refs.has(name)) refs.set(name, Math.max(1, refs.get(name) || 0));
}
for (const name of allow.allowUnknown) {
  if (unknown.has(name)) unknown.delete(name);
}

const errors = [];
const warnings = [];

for (const name of flagNames) {
  if ((refs.get(name) || 0) === 0) warnings.push(`${name}: unused`);
}
for (const [name, count] of unknown.entries()) {
  errors.push(`unknown flag usage "${name}" (${count} refs)`);
}

console.log("[ff-doctor] files:", files.length);
console.log("[ff-doctor] errors:", errors.length);
errors.forEach((e) => console.log("  -", e));
console.log("[ff-doctor] warnings:", warnings.length);
warnings.forEach((w) => console.log("  -", w));

process.exit(errors.length ? 1 : warnings.length ? 2 : 0);
