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

function buildLineIndex(text) {
  const indexes = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") indexes.push(i + 1);
  }
  return indexes;
}

function positionToLineCol(indexes, pos) {
  let lo = 0;
  let hi = indexes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (indexes[mid] <= pos) lo = mid + 1;
    else hi = mid - 1;
  }
  const start = indexes[hi] ?? 0;
  return { line: hi + 1, col: pos - start + 1 };
}

export function scanTextForFlags(text, flagNames) {
  const cleaned = stripComments(text);
  const lineIndex = buildLineIndex(cleaned);
  const known = new Set(flagNames);
  const refs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();
  const occurrences = [];

  for (const pat of usagePatterns) {
    const re = new RegExp(pat.source, pat.flags);
    for (const m of cleaned.matchAll(re)) {
      const name = m[2] || m[1];
      if (!name) continue;
      const index = m.index ?? 0;
      const { line, col } = positionToLineCol(lineIndex, index);
      occurrences.push({ name, index, line, col, kind: pat.toString() });
      if (known.has(name)) refs.set(name, (refs.get(name) || 0) + 1);
      else unknown.set(name, (unknown.get(name) || 0) + 1);
    }
  }
  return { refs, unknown, occurrences };
}

export default scanTextForFlags;
