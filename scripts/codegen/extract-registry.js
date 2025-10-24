import fs from "node:fs";
import path from "node:path";

import { stripComments } from "../utils/strip-comments.js";

function findObjectLiteralAfter(code, anchor) {
  const idx = code.indexOf(anchor);
  if (idx < 0) throw new Error(`anchor not found: ${anchor}`);
  const after = code.slice(idx + anchor.length);
  // найдём первый символ '{' после '='
  const eq = after.indexOf("=");
  if (eq < 0) throw new Error('no "=" after anchor');
  const rest = after.slice(eq + 1);
  let i = 0;
  while (i < rest.length && /\s/.test(rest[i])) i++;
  if (rest[i] !== "{") throw new Error("object literal not found");
  // парсим скобки с учётом строк/шаблонов
  let start = i;
  let depth = 0;
  let state = 0; // 0-normal,1-squote,2-dquote,3-template,4-template-expr
  let braceDepth = 0;
  for (; i < rest.length; i++) {
    const c = rest[i],
      n = rest[i + 1];
    if (state === 0) {
      if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          const lit = rest.slice(start, i + 1);
          return lit;
        }
      } else if (c === "'") state = 1;
      else if (c === '"') state = 2;
      else if (c === "`") state = 3;
      else if (c === "/" && n === "*") {
        // skip block
        const j = rest.indexOf("*/", i + 2);
        if (j < 0) throw new Error("unclosed /* */");
        i = j + 1;
        continue;
      } else if (c === "/" && n === "/") {
        // skip line
        const j = rest.indexOf("\n", i + 2);
        i = j < 0 ? rest.length : j;
        continue;
      }
      continue;
    }
    if (state === 1) {
      if (c === "\\") {
        i++;
      } else if (c === "'") state = 0;
      continue;
    }
    if (state === 2) {
      if (c === "\\") {
        i++;
      } else if (c === '"') state = 0;
      continue;
    }
    if (state === 3) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "`") {
        state = 0;
        continue;
      }
      if (c === "$" && n === "{") {
        state = 4;
        braceDepth = 0;
        i++;
        continue;
      }
      continue;
    }
    if (state === 4) {
      if (c === "{") braceDepth++;
      else if (c === "}") {
        if (braceDepth === 0) {
          state = 3;
        } else braceDepth--;
      } else if (c === "'" || c === '"' || c === "`") {
        /* strings inside expr are not critical here */
      }
      continue;
    }
  }
  throw new Error("unterminated object literal");
}

export function readFlagRegistryObject() {
  const tsPath = path.join(process.cwd(), "lib", "ff", "flags.ts");
  const srcRaw = fs.readFileSync(tsPath, "utf8");
  const src = stripComments(srcRaw)
    .replace(/as\s+const/g, "") // remove TS assertions
    .replace(/:\s*Record<[^>]+>\s*=/g, "=") // remove type annotation on const
    .replace(/\s+as\s+[A-Za-z0-9_.<>,\s]+(?=[,}])/g, ""); // remove inline type assertions
  const lit = findObjectLiteralAfter(src, "export const FLAG_REGISTRY");
  // безопасная оценка: чистый объектный литерал
  // eslint-disable-next-line no-new-func
  const obj = Function(`"use strict"; return (${lit});`)();
  if (!obj || typeof obj !== "object") throw new Error("registry object is not an object");
  return obj;
}

export function readFlagNamesFromUnion() {
  const tsPath = path.join(process.cwd(), "lib", "ff", "flags.ts");
  const src = fs.readFileSync(tsPath, "utf8");
  const m = src.match(/export\s+type\s+FlagName\s*=\s*([^;]+);/m);
  if (!m) return [];
  const body = m[1];
  return Array.from(body.matchAll(/['"]([a-zA-Z0-9_-]+)['"]/g)).map((x) => x[1]);
}

export function getRegistryAndNames() {
  try {
    const reg = readFlagRegistryObject();
    return { registry: reg, names: Object.keys(reg) };
  } catch {
    const names = readFlagNamesFromUnion();
    return { registry: null, names };
  }
}

export default getRegistryAndNames;
