const CHECKED_CALLEES = new Set(["getFlag", "getFlagServer", "getFlagServerWithMeta"]);

const JSX_FLAG_PROP_MAP = new Map([
  ["ClientGate", new Set(["requireFlag"])],
  ["ServerGate", new Set(["requireFlag"])],
  ["FlagGate", new Set(["name"])],
  ["FlagGateServer", new Set(["name"])],
  ["FlagGateClient", new Set(["name"])],
  ["PercentGate", new Set(["name"])],
  ["PercentGateServer", new Set(["name"])],
  ["PercentGateClient", new Set(["name"])],
  ["VariantGate", new Set(["name"])],
  ["VariantGateServer", new Set(["name"])],
  ["VariantGateClient", new Set(["name"])],
]);

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ChainExpression")
  ) {
    current = current.expression;
  }
  return current;
}

function isStaticFlagKey(node, { allowIdentifiers = true } = {}) {
  const target = unwrapExpression(node);
  if (!target) return false;

  switch (target.type) {
    case "Literal":
      return typeof target.value === "string";
    case "TemplateLiteral":
      return target.expressions.length === 0;
    case "Identifier":
      return allowIdentifiers;
    default:
      return false;
  }
}

function getJsxElementName(node) {
  if (!node) return null;
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") return getJsxElementName(node.property);
  if (node.type === "JSXNamespacedName") return node.name?.name ?? null;
  return null;
}

function getCalleeName(callee) {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "ChainExpression") {
    return getCalleeName(callee.expression.callee ?? callee.expression);
  }
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Disallow dynamic feature-flag keys" },
    schema: [],
    messages: {
      dynamic: 'Feature flag key passed to "{{name}}" must be a static string literal or constant.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (!name || !CHECKED_CALLEES.has(name)) return;
        const [first] = node.arguments;
        if (!first) return;
        if (!isStaticFlagKey(first)) {
          context.report({ node: first, messageId: "dynamic", data: { name } });
        }
      },
      OptionalCallExpression(node) {
        const name = getCalleeName(node.callee);
        if (!name || !CHECKED_CALLEES.has(name)) return;
        const [first] = node.arguments;
        if (!first) return;
        if (!isStaticFlagKey(first)) {
          context.report({ node: first, messageId: "dynamic", data: { name } });
        }
      },
      JSXAttribute(node) {
        if (!node.value) return;
        const opening = node.parent;
        if (!opening || opening.type !== "JSXOpeningElement") return;

        const elementName = getJsxElementName(opening.name);
        if (!elementName) return;
        const trackedProps = JSX_FLAG_PROP_MAP.get(elementName);
        if (!trackedProps) return;

        const attrName = node.name?.name;
        if (!attrName || !trackedProps.has(attrName)) return;

        const rawValue =
          node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        if (!rawValue) return;

        if (!isStaticFlagKey(rawValue, { allowIdentifiers: false })) {
          const label = `<${elementName} ${attrName}>`;
          context.report({
            node: rawValue ?? node.value,
            messageId: "dynamic",
            data: { name: label },
          });
        }
      },
    };
  },
};
