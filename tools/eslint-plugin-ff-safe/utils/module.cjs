const SHARED_HEADER_PATTERN = /@ff-safe\s+shared\b/i;

function detectModuleDirectives(body = []) {
  for (const stmt of body) {
    if (
      stmt.type === "ExpressionStatement" &&
      stmt.expression &&
      stmt.expression.type === "Literal" &&
      typeof stmt.expression.value === "string"
    ) {
      const value = stmt.expression.value;
      if (value === "use client") return "client";
      if (value === "use server") return "server";
      continue;
    }
    break;
  }
  return null;
}

function getModuleType(context) {
  const sourceCode = context.getSourceCode();
  const header = sourceCode.getText().slice(0, 200);
  if (SHARED_HEADER_PATTERN.test(header)) {
    return "shared";
  }

  const directive = detectModuleDirectives(sourceCode.ast.body);
  if (directive === "client") return "client";
  return "server";
}

function getModuleClassification(context) {
  const type = getModuleType(context);
  return {
    type,
    isClient: type === "client",
    isServer: type === "server",
    isShared: type === "shared",
  };
}

module.exports = {
  getModuleClassification,
};
