/**
 * Rule: no-ff-server-in-client
 * Запрещает вызовы/импорты серверных FF-API в файлах с директивой 'use client'.
 * Блокируемые сущности: getFlagsServer, getFlagServer, getFlagsServerWithMeta,
 * getFeatureFlags, getFeatureFlagsFromHeaders, getFeatureFlagsFromHeadersWithSources.
 */
const BLOCKED = new Set([
  "getFlagsServer",
  "getFlagServer",
  "getFlagsServerWithMeta",
  "getFeatureFlags",
  "getFeatureFlagsFromHeaders",
  "getFeatureFlagsFromHeadersWithSources",
]);

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Disallow server-side FF APIs in client components" },
    schema: [],
    messages: {
      blocked: 'Do not use server-side FF API "{{name}}" inside a "use client" module.',
    },
  },
  create(context) {
    let isClient = false;
    return {
      Program(node) {
        const body = node.body || [];
        for (const stmt of body) {
          if (
            stmt.type === "ExpressionStatement" &&
            stmt.expression.type === "Literal" &&
            stmt.expression.value === "use client"
          ) {
            isClient = true;
            break;
          }
        }
      },
      ImportSpecifier(node) {
        if (!isClient) return;
        const localName = node.local?.name;
        if (localName && BLOCKED.has(localName)) {
          context.report({ node, messageId: "blocked", data: { name: localName } });
        }
      },
      Identifier(node) {
        if (!isClient) return;
        const name = node.name;
        if (BLOCKED.has(name)) {
          context.report({ node, messageId: "blocked", data: { name } });
        }
      },
    };
  },
};
