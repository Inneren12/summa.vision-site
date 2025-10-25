import path from "node:path";

// Опциональный AST-сканер на базе ts-morph. Поддерживает TS/TSX/JS/JSX.

let tsMorphModulePromise;
let projectPromise;
let virtualId = 0;

async function loadTsMorph() {
  if (!tsMorphModulePromise) {
    tsMorphModulePromise = import("ts-morph");
  }
  return tsMorphModulePromise;
}

async function getProject() {
  if (!projectPromise) {
    projectPromise = (async () => {
      const tsMorph = await loadTsMorph();
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
  try {
    await loadTsMorph();
    return true;
  } catch {
    return false;
  }
}

export async function scanTextForFlagsAST(text, filename, flagNames) {
  const ok = await astAvailable();
  if (!ok) return { refs: new Map(), fuzzyRefs: new Map(), unknown: new Map(), occurrences: [] };

  const tsMorph = await loadTsMorph();
  let project;
  try {
    project = await getProject();
  } catch {
    return { refs: new Map(), fuzzyRefs: new Map(), unknown: new Map(), occurrences: [] };
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
    return { refs, fuzzyRefs, unknown, occurrences };
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
