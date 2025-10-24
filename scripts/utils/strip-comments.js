// Robust comment stripper for JS/TS/JSX/TSX:
// - Removes // line and /* block */ comments
// - Preserves content inside single, double and template strings
// - Handles escapes and ${...} inside templates
// - Known limitation: regex literals with '//' may be misread as comments (rare for our use).
export function stripComments(code) {
  const NORMAL = 0,
    SQUOTE = 1,
    DQUOTE = 2,
    TEMPLATE = 3,
    BLOCK = 4,
    LINE = 5,
    TEMPLATE_EXPR = 6;
  let state = NORMAL;
  let out = "";
  let i = 0;
  let braceDepth = 0;
  const len = code.length;
  while (i < len) {
    const c = code[i];
    const n = i + 1 < len ? code[i + 1] : "";
    if (state === NORMAL) {
      if (c === "'") {
        state = SQUOTE;
        out += c;
        i++;
        continue;
      }
      if (c === '"') {
        state = DQUOTE;
        out += c;
        i++;
        continue;
      }
      if (c === "`") {
        state = TEMPLATE;
        out += c;
        i++;
        continue;
      }
      if (c === "/" && n === "*") {
        state = BLOCK;
        out += " ";
        i += 2;
        continue;
      }
      if (c === "/" && n === "/") {
        state = LINE;
        out += " ";
        i += 2;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (state === LINE) {
      if (c === "\n") {
        state = NORMAL;
        out += "\n";
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (state === BLOCK) {
      if (c === "*" && n === "/") {
        state = NORMAL;
        out += " ";
        i += 2;
        continue;
      }
      if (c === "\n") out += "\n";
      i++;
      continue;
    }
    if (state === SQUOTE) {
      if (c === "\\") {
        out += c;
        if (i + 1 < len) {
          out += code[i + 1];
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (c === "'") {
        state = NORMAL;
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (state === DQUOTE) {
      if (c === "\\") {
        out += c;
        if (i + 1 < len) {
          out += code[i + 1];
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (c === '"') {
        state = NORMAL;
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (state === TEMPLATE) {
      if (c === "\\") {
        out += c;
        if (i + 1 < len) {
          out += code[i + 1];
          i += 2;
        } else {
          i++;
        }
        continue;
      }
      if (c === "`") {
        state = NORMAL;
        out += c;
        i++;
        continue;
      }
      if (c === "$" && n === "{") {
        state = TEMPLATE_EXPR;
        braceDepth = 0;
        out += c + n;
        i += 2;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (state === TEMPLATE_EXPR) {
      if (c === "{") {
        braceDepth++;
        out += c;
        i++;
        continue;
      }
      if (c === "}") {
        if (braceDepth === 0) {
          state = TEMPLATE;
          out += c;
          i++;
          continue;
        }
        braceDepth--;
        out += c;
        i++;
        continue;
      }
      if (c === "'") {
        state = SQUOTE;
        out += c;
        i++;
        continue;
      }
      if (c === '"') {
        state = DQUOTE;
        out += c;
        i++;
        continue;
      }
      if (c === "`") {
        state = TEMPLATE;
        out += c;
        i++;
        continue;
      }
      if (c === "/" && n === "*") {
        state = BLOCK;
        out += " ";
        i += 2;
        continue;
      }
      if (c === "/" && n === "/") {
        state = LINE;
        out += " ";
        i += 2;
        continue;
      }
      out += c;
      i++;
      continue;
    }
  }
  return out;
}

export default stripComments;
