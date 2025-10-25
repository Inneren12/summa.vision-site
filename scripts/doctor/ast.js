import path from "node:path";

// Опциональный AST-сканер на базе ts-morph. Поддерживает TS/TSX/JS/JSX.

let tsMorphModulePromise;
let projectPromise;
let fallbackToRegex = false;
let virtualId = 0;

async function loadTsMorph() {
  if (fallbackToRegex) {
    return null;
  }
  if (!tsMorphModulePromise) {
    tsMorphModulePromise = import("ts-morph").catch(() => {
      fallbackToRegex = true;
      return null;
    });
  }
  const tsMorphModule = await tsMorphModulePromise;
  if (!tsMorphModule) {
    fallbackToRegex = true;
    return null;
  }
  return tsMorphModule;
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
  const tsMorphModule = await loadTsMorph();
  return Boolean(tsMorphModule) || fallbackToRegex;
}

export async function scanTextForFlagsAST(text, filename, flagNames) {
  const ok = await astAvailable();
  if (!ok) return { refs: new Map(), fuzzyRefs: new Map(), unknown: new Map(), occurrences: [] };

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

function positionFromIndex(text, index) {
  let line = 1;
  let col = 0;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      col = 0;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

function scanWithFallback(text, flagNames) {
  const refs = new Map(flagNames.map((n) => [n, 0]));
  const fuzzyRefs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();
  const occurrences = [];
  const known = new Set(flagNames);

  const record = (name, index, kind) => {
    if (!name) return;
    const { line, col } = positionFromIndex(text, index);
    occurrences.push({ name, index, line, col, kind, fuzzy: false });
    if (known.has(name)) {
      refs.set(name, (refs.get(name) || 0) + 1);
    } else {
      unknown.set(name, (unknown.get(name) || 0) + 1);
    }
  };

  const hookPattern = /useFlag\s*\(\s*(["'`])([^"'`\s)]+)\1/g;
  let hookMatch;
  while ((hookMatch = hookPattern.exec(text))) {
    const [, , value] = hookMatch;
    if (!value) continue;
    const offset = hookMatch.index + hookMatch[0].indexOf(value);
    record(value, offset, "hook");
  }

  const gatePattern =
    /<(FlagGate|FlagGateServer|FlagGateClient|PercentGate|PercentGateServer|PercentGateClient|VariantGate|VariantGateServer|VariantGateClient)\b([^>]*)>/g;
  let gateMatch;
  while ((gateMatch = gatePattern.exec(text))) {
    const [, , attrs] = gateMatch;
    const nameMatch = attrs.match(/name\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*['"]([^'"}]+)['"]\s*\})/);
    if (!nameMatch) continue;
    const value = nameMatch[1] ?? nameMatch[2] ?? nameMatch[3];
    if (!value) continue;
    const nameIndex = gateMatch.index + gateMatch[0].indexOf(nameMatch[0]);
    record(value, nameIndex, "jsx");
  }

  return { refs, fuzzyRefs, unknown, occurrences };
}
