const { getModuleClassification } = require("../utils/module.cjs");

const CLIENT_TELEMETRY_PATTERNS = [
  /(^|\/)ff\/exposure\.client(?:\.[^/]+)?$/i,
  /(^|\/)ff\/telemetry\.client(?:\.[^/]+)?$/i,
];

function isClientTelemetryPath(value) {
  if (typeof value !== "string") return false;
  return CLIENT_TELEMETRY_PATTERNS.some((pattern) => pattern.test(value));
}

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Disallow importing client telemetry helpers inside server modules" },
    schema: [],
    messages: {
      forbidden: "Client-side telemetry helpers must not be imported in server modules.",
    },
  },
  create(context) {
    const moduleInfo = getModuleClassification(context);
    const shouldCheck = moduleInfo.isServer && !moduleInfo.isShared;
    if (!shouldCheck) {
      return {};
    }

    function report(node) {
      context.report({ node, messageId: "forbidden" });
    }

    function checkSource(node, source) {
      if (isClientTelemetryPath(source?.value ?? source)) {
        report(node.source ?? node);
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkSource(node, node.source);
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          checkSource(node, node.source);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length > 0
        ) {
          const arg = node.arguments[0];
          if (arg.type === "Literal" && typeof arg.value === "string") {
            checkSource(arg, arg.value);
          }
        }
      },
    };
  },
};
