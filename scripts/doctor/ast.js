// Опциональный AST-сканер. Работает, если доступны "acorn" и "acorn-jsx".
// Поддерживает .js/.jsx. Для .ts/.tsx автоматически используйте regex-режим.

export async function astAvailable() {
  try {
    await import("acorn");
    await import("acorn-jsx");
    return true;
  } catch {
    return false;
  }
}

export async function scanTextForFlagsAST(text, filename, flagNames) {
  const ok = await astAvailable();
  if (!ok) return { refs: new Map(), unknown: new Map(), occurrences: [] };
  let acorn, jsx;
  try {
    acorn = (await import("acorn")).Parser;
    jsx = (await import("acorn-jsx")).default;
  } catch {
    return { refs: new Map(), unknown: new Map(), occurrences: [] };
  }
  const Parser = acorn.extend(jsx());
  let ast;
  try {
    ast = Parser.parse(text, { ecmaVersion: "latest", sourceType: "module" });
  } catch {
    // Не смогли распарсить (возможно TS/TSX) — пустой результат (regex подстрахует).
    return { refs: new Map(), unknown: new Map(), occurrences: [] };
  }
  const known = new Set(flagNames);
  const refs = new Map(flagNames.map((n) => [n, 0]));
  const fuzzyRefs = new Map(flagNames.map((n) => [n, 0]));
  const unknown = new Map();
  const occurrences = [];

  function addHit(name, index) {
    if (!name) return;
    // Посчитаем line/col из индекса
    const before = text.slice(0, index);
    const line = (before.match(/\n/g)?.length ?? 0) + 1;
    const col = index - (before.lastIndexOf("\n") + 1) + 1;
    occurrences.push({ name, index, line, col, kind: "ast", fuzzy: false });
    if (known.has(name)) refs.set(name, (refs.get(name) || 0) + 1);
    else unknown.set(name, (unknown.get(name) || 0) + 1);
  }

  function isIdent(node, name) {
    return node && node.type === "Identifier" && node.name === name;
  }

  function walk(node) {
    if (!node || typeof node.type !== "string") return;
    // Ищем useFlag('name')
    if (node.type === "CallExpression" && isIdent(node.callee, "useFlag")) {
      const arg = node.arguments?.[0];
      if (
        arg &&
        (arg.type === "Literal" || arg.type === "StringLiteral") &&
        typeof arg.value === "string"
      ) {
        addHit(arg.value, arg.start ?? node.start ?? 0);
      }
    }
    // Ищем JSX: <FlagGate ... name="x" />, <PercentGate ... name="x" />, <VariantGate ... />
    if (node.type === "JSXOpeningElement") {
      const n = node.name;
      const isGate =
        n.type === "JSXIdentifier" &&
        (n.name === "FlagGate" ||
          n.name === "FlagGateServer" ||
          n.name === "FlagGateClient" ||
          n.name === "PercentGate" ||
          n.name === "PercentGateServer" ||
          n.name === "PercentGateClient" ||
          n.name === "VariantGate" ||
          n.name === "VariantGateServer" ||
          n.name === "VariantGateClient");
      if (isGate) {
        const nameAttr = node.attributes?.find(
          (a) => a.type === "JSXAttribute" && a.name?.name === "name",
        );
        if (
          nameAttr &&
          nameAttr.value &&
          nameAttr.value.type === "Literal" &&
          typeof nameAttr.value.value === "string"
        ) {
          addHit(nameAttr.value.value, nameAttr.value.start ?? node.start ?? 0);
        }
      }
    }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (v && typeof v === "object") {
        if (Array.isArray(v)) v.forEach((child) => walk(child));
        else walk(v);
      }
    }
  }
  walk(ast);
  return { refs, fuzzyRefs, unknown, occurrences };
}
