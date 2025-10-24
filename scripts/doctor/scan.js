import { stripComments } from "../utils/strip-comments.js";

// Паттерны реального использования флагов:
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

export function scanTextForFlags(text, flagNames) {
  const cleaned = stripComments(text);
  const known = new Set(flagNames);
  const refs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();

  for (const pat of usagePatterns) {
    const re = new RegExp(pat.source, pat.flags);
    for (const m of cleaned.matchAll(re)) {
      const name = m[2] || m[1];
      if (!name) continue;
      if (known.has(name)) refs.set(name, (refs.get(name) || 0) + 1);
      else unknown.set(name, (unknown.get(name) || 0) + 1);
    }
  }
  return { refs, unknown };
}

export default scanTextForFlags;
