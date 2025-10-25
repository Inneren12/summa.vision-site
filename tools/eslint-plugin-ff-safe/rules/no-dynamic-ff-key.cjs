const CHECKED_CALLEES = new Set(["getFlag", "getFlagServer", "getFlagServerWithMeta"]);

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

function isStaticFlagKey(node) {
  const target = unwrapExpression(node);
  if (!target) return false;

  switch (target.type) {
    case "Literal":
      return typeof target.value === "string";
    case "TemplateLiteral":
      return target.expressions.length === 0;
    case "Identifier":
      return true;
    default:
      return false;
  }
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
    };
  },
};
