import { stripComments } from "../utils/strip-comments.js";

// Паттерны использования флагов. Fuzzy указывает на "серые" ссылки (строки, URL и пр.)
const usagePatterns = [
  {
    regex: /useFlag\(\s*(['"])([a-zA-Z0-9_-]+)\1\s*\)/g,
    kind: "hook",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /<FlagGate(?:Server|Client)?\b[^>]*\bname=(['"])([a-zA-Z0-9_-]+)\1/g,
    kind: "jsx",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /<PercentGate(?:Server|Client)?\b[^>]*\bname=(['"])([a-zA-Z0-9_-]+)\1/g,
    kind: "jsx",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /<VariantGate(?:Server|Client)?\b[^>]*\bname=(['"])([a-zA-Z0-9_-]+)\1/g,
    kind: "jsx",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /<FlagGate(?:Server|Client)?\b[^>]*\bname=\{\s*(['"])([a-zA-Z0-9_-]+)\1\s*\}/g,
    kind: "jsx",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /<PercentGate(?:Server|Client)?\b[^>]*\bname=\{\s*(['"])([a-zA-Z0-9_-]+)\1\s*\}/g,
    kind: "jsx",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /<VariantGate(?:Server|Client)?\b[^>]*\bname=\{\s*(['"])([a-zA-Z0-9_-]+)\1\s*\}/g,
    kind: "jsx",
    fuzzy: false,
    extract: (match) => match[2] || match[1],
  },
  {
    regex: /\?ff=([a-zA-Z0-9_-]+)\s*:/g,
    kind: "query",
    fuzzy: true,
    extract: (match) => match[1],
  },
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
  const fuzzyRefs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();
  const occurrences = [];

  for (const pat of usagePatterns) {
    const re = new RegExp(pat.regex.source, pat.regex.flags);
    for (const m of cleaned.matchAll(re)) {
      const name = pat.extract(m);
      if (!name) continue;
      const index = m.index ?? 0;
      const { line, col } = positionToLineCol(lineIndex, index);
      occurrences.push({ name, index, line, col, kind: pat.kind, fuzzy: pat.fuzzy });
      if (known.has(name)) {
        if (pat.fuzzy) {
          fuzzyRefs.set(name, (fuzzyRefs.get(name) || 0) + 1);
        } else {
          refs.set(name, (refs.get(name) || 0) + 1);
        }
      } else {
        unknown.set(name, (unknown.get(name) || 0) + 1);
      }
    }
  }
  return { refs, fuzzyRefs, unknown, occurrences };
}

export default scanTextForFlags;
