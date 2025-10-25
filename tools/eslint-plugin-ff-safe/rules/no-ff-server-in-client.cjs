/**
 * Rule: no-ff-server-in-client
 * Запрещает вызовы/импорты серверных FF-API в файлах с директивой 'use client'.
 * Блокируемые сущности: getFlagsServer, getFlagServer, getFlagsServerWithMeta,
 * getFeatureFlags, getFeatureFlagsFromHeaders, getFeatureFlagsFromHeadersWithSources.
 */
const { getModuleClassification } = require("../utils/module.cjs");

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
    const moduleInfo = getModuleClassification(context);
    const shouldCheck = moduleInfo.isClient && !moduleInfo.isShared;

    return {
      ImportSpecifier(node) {
        if (!shouldCheck) return;
        const imported = node.imported;
        const importedName = imported && imported.type === "Identifier" ? imported.name : undefined;
        const localName = node.local?.name;

        if (importedName && BLOCKED.has(importedName)) {
          context.report({ node, messageId: "blocked", data: { name: importedName } });
          return;
        }
        if (localName && BLOCKED.has(localName)) {
          context.report({ node, messageId: "blocked", data: { name: localName } });
        }
      },
    };
  },
};
