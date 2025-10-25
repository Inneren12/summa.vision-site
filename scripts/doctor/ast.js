import path from "node:path";

// Опциональный AST-сканер на базе ts-morph. Поддерживает TS/TSX/JS/JSX.

const FALLBACK_ENABLED = true;
let tsMorphModulePromise;
let tsMorphModule;
let projectPromise;
let fallbackToRegex = false;
let virtualId = 0;

async function loadTsMorph() {
  if (fallbackToRegex) {
    return null;
  }
  if (!tsMorphModulePromise) {
    tsMorphModulePromise = import("ts-morph").catch(() => null);
  }
  return tsMorphModulePromise;
}

async function getProject() {
  if (fallbackToRegex) {
    return null;
  }
  if (!projectPromise) {
    projectPromise = (async () => {
      const tsMorph = await loadTsMorph();
      if (!tsMorph) return null;
      const { Project, ts } = tsMorph;
      return new Project({
        useInMemoryFileSystem: true,
        skipFileDependencyResolution: true,
        compilerOptions: {
          allowJs: true,
          allowSyntheticDefaultImports: true,
          jsx: ts.JsxEmit.Preserve,
          target: ts.ScriptTarget.ES2020,
        },
      });
    })();
  }
  return projectPromise;
}

function getScriptKind(tsMorph, filename) {
  const ext = path.extname(filename ?? "").toLowerCase();
  const { ts } = tsMorph;
  switch (ext) {
    case ".ts":
    case ".mts":
    case ".cts":
      return ts.ScriptKind.TS;
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

export async function astAvailable() {
  const tsMorph = await loadTsMorph();
  return tsMorph !== null || FALLBACK_ENABLED;
}

export async function scanTextForFlagsAST(text, filename, flagNames) {
  const tsMorph = await loadTsMorph();
  if (!tsMorph) {
    return scanWithFallback(text, flagNames);
  }
  let project;
  try {
    project = await getProject();
  } catch {
    return scanWithFallback(text, flagNames);
  }
  if (!project) {
    return scanWithFallback(text, flagNames);
  }

  const refs = new Map(flagNames.map((n) => [n, 0]));
  const fuzzyRefs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();
  const occurrences = [];
  const known = new Set(flagNames);

  const ext = path.extname(filename ?? "");
  const virtualPath = `/ff-doctor/${virtualId++}${ext || ".ts"}`;
  let sourceFile;

  try {
    sourceFile = project.createSourceFile(virtualPath, text, {
      overwrite: true,
      scriptKind: getScriptKind(tsMorph, filename),
    });
  } catch {
    return scanWithFallback(text, flagNames);
  }

  const gateNames = new Set([
    "FlagGate",
    "FlagGateServer",
    "FlagGateClient",
    "PercentGate",
    "PercentGateServer",
    "PercentGateClient",
    "VariantGate",
    "VariantGateServer",
    "VariantGateClient",
  ]);

  const { Node } = tsMorph;

  const record = (name, node, kind, fuzzy = false) => {
    if (!name || !node) return;
    const pos = node.getStart(false);
    const { line, column } = sourceFile.getLineAndColumnAtPos(pos);
    occurrences.push({ name, index: pos, line, col: column, kind, fuzzy });
    if (known.has(name)) {
      if (fuzzy) {
        fuzzyRefs.set(name, (fuzzyRefs.get(name) || 0) + 1);
      } else {
        refs.set(name, (refs.get(name) || 0) + 1);
      }
    } else {
      unknown.set(name, (unknown.get(name) || 0) + 1);
    }
  };

  const extractLiteral = (node) => {
    if (!node) return { value: null, target: null };
    if (Node.isStringLiteral(node)) {
      return { value: node.getLiteralValue(), target: node };
    }
    if (Node.isNoSubstitutionTemplateLiteral(node)) {
      return { value: node.getLiteralText(), target: node };
    }
    return { value: null, target: null };
  };

  try {
    sourceFile.forEachDescendant((desc) => {
      if (Node.isCallExpression(desc)) {
        const expr = desc.getExpression();
        if (Node.isIdentifier(expr) && expr.getText() === "useFlag") {
          const arg = desc.getArguments()[0];
          const { value, target } = extractLiteral(arg);
          if (typeof value === "string") {
            record(value, target ?? desc, "hook");
          }
        }
      }

      if (Node.isJsxOpeningElement(desc) || Node.isJsxSelfClosingElement(desc)) {
        const tag = desc.getTagNameNode();
        const tagName = tag?.getText();
        if (tagName && gateNames.has(tagName)) {
          for (const attr of desc.getAttributes()) {
            if (!Node.isJsxAttribute(attr)) continue;
            const attrName = attr.getNameNode()?.getText();
            if (attrName !== "name") continue;
            const initializer = attr.getInitializer();
            if (!initializer) continue;
            if (Node.isStringLiteral(initializer)) {
              const { value, target } = extractLiteral(initializer);
              if (typeof value === "string") record(value, target ?? initializer, "jsx");
            } else if (Node.isJsxExpression(initializer)) {
              const expr = initializer.getExpression();
              const { value, target } = extractLiteral(expr);
              if (typeof value === "string") record(value, target ?? expr ?? initializer, "jsx");
            }
          }
        }
      }
    });
  } catch {
    // ignore parsing issues, fallback произойдет через regex
  } finally {
    sourceFile?.forget();
  }

  return { refs, fuzzyRefs, unknown, occurrences };
}

function createEmptyResult(flagNames) {
  const refs = new Map(flagNames.map((n) => [n, 0]));
  const fuzzyRefs = new Map(flagNames.map((n) => [n, 0]));
  return { refs, fuzzyRefs, unknown: new Map(), occurrences: [] };
}

function positionFromIndex(text, index) {
  const slice = text.slice(0, index);
  const lines = slice.split(/\r?\n/);
  const line = lines.length === 0 ? 1 : lines.length;
  const column = lines.length === 0 ? 1 : lines[lines.length - 1].length + 1;
  return { line, column };
}

function scanWithFallback(text, flagNames) {
  const result = createEmptyResult(flagNames);
  const known = new Set(flagNames);
  const record = (name, index, kind) => {
    if (!name) return;
    const { line, column } = positionFromIndex(text, index);
    result.occurrences.push({ name, index, line, col: column, kind, fuzzy: false });
    if (known.has(name)) {
      result.refs.set(name, (result.refs.get(name) || 0) + 1);
    } else {
      result.unknown.set(name, (result.unknown.get(name) || 0) + 1);
    }
  };

  const useFlagPattern = /useFlag\s*\(\s*(["'`])([^"'`\r\n]+?)\1/dg;
  let match;
  while ((match = useFlagPattern.exec(text)) !== null) {
    const literalIndex = match.indices?.[2]?.[0] ?? match.index;
    record(match[2], literalIndex, "hook");
  }

  const gatePattern =
    /<(FlagGate(?:Server|Client)?|PercentGate(?:Server|Client)?|VariantGate(?:Server|Client)?)\b[^>]*?\bname\s*=\s*(?:(["'])([^"'`\r\n]+?)\2|\{\s*(["'])([^"'`\r\n]+?)\4\s*\})/dg;
  while ((match = gatePattern.exec(text)) !== null) {
    const value = match[3] ?? match[5];
    const literalIndex = match.indices?.[3]?.[0] ?? match.indices?.[5]?.[0] ?? match.index;
    record(value, literalIndex, "jsx");
  }

  return result;
}
