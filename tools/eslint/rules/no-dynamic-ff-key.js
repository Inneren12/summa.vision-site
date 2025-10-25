"use strict";

const FLAG_COMPONENT_PROPS = new Map([
  ["FlagGate", new Set(["name"])],
  ["FlagGateServer", new Set(["name"])],
  ["FlagGateClient", new Set(["name"])],
  ["PercentGate", new Set(["name"])],
  ["PercentGateServer", new Set(["name"])],
  ["PercentGateClient", new Set(["name"])],
  ["VariantGate", new Set(["name"])],
  ["VariantGateServer", new Set(["name"])],
  ["VariantGateClient", new Set(["name"])],
  ["ServerGate", new Set(["requireFlag"])],
  ["ClientGate", new Set(["requireFlag"])],
]);

const IMPORT_PATTERNS = [
  { regex: /components\/gates\/FlagGate\.server$/, component: "FlagGateServer" },
  { regex: /components\/gates\/FlagGate\.client$/, component: "FlagGateClient" },
  { regex: /components\/gates\/FlagGate$/, component: "FlagGate" },
  { regex: /components\/gates\/PercentGate\.server$/, component: "PercentGateServer" },
  { regex: /components\/gates\/PercentGate\.client$/, component: "PercentGateClient" },
  { regex: /components\/gates\/PercentGate$/, component: "PercentGate" },
  { regex: /components\/gates\/VariantGate\.server$/, component: "VariantGateServer" },
  { regex: /components\/gates\/VariantGate\.client$/, component: "VariantGateClient" },
  { regex: /components\/gates\/VariantGate$/, component: "VariantGate" },
  { regex: /components\/gates\/ServerGate$/, component: "ServerGate" },
  { regex: /components\/gates\/ClientGate$/, component: "ClientGate" },
];

function unwrapExpression(expression) {
  let node = expression;
  while (
    node &&
    (node.type === "TSAsExpression" ||
      node.type === "TSTypeAssertion" ||
      node.type === "TSNonNullExpression" ||
      node.type === "ParenthesizedExpression")
  ) {
    node = node.expression;
  }
  return node;
}

function isStaticStringExpression(expression) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (node.type === "Literal") {
    return typeof node.value === "string";
  }
  if (node.type === "TemplateLiteral") {
    return node.expressions.length === 0;
  }
  return false;
}

function isStaticStringAttribute(attr) {
  if (!attr.value) {
    return false;
  }
  if (attr.value.type === "Literal") {
    return typeof attr.value.value === "string";
  }
  if (attr.value.type === "JSXExpressionContainer") {
    return isStaticStringExpression(attr.value.expression);
  }
  return false;
}

function registerAlias(target, alias, componentName) {
  const props = FLAG_COMPONENT_PROPS.get(componentName);
  if (!props) {
    return;
  }
  target.set(alias, props);
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow dynamic feature flag keys in JSX props",
      recommended: false,
    },
    schema: [],
    messages: {
      onlyLiteral: "Flag prop '{{prop}}' on <{{component}}> must be a string literal.",
      noSpread:
        "Do not spread props into <{{component}}> because flag keys must be explicit string literals.",
    },
  },
  create(context) {
    const aliasToProps = new Map(FLAG_COMPONENT_PROPS);

    function handleImport(node) {
      const source = node.source.value;
      if (typeof source !== "string") {
        return;
      }
      for (const pattern of IMPORT_PATTERNS) {
        if (!pattern.regex.test(source)) {
          continue;
        }
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") {
            registerAlias(aliasToProps, specifier.local.name, pattern.component);
          } else if (specifier.type === "ImportSpecifier") {
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value;
            const componentName = FLAG_COMPONENT_PROPS.has(importedName)
              ? importedName
              : pattern.component;
            registerAlias(aliasToProps, specifier.local.name, componentName);
          }
        }
      }
    }

    function getElementName(node) {
      if (node.type === "JSXIdentifier") {
        return node.name;
      }
      if (node.type === "JSXMemberExpression") {
        // for expressions like Namespace.Component
        let current = node;
        const parts = [];
        while (current) {
          if (current.type === "JSXIdentifier") {
            parts.unshift(current.name);
            break;
          }
          if (current.type === "JSXMemberExpression") {
            parts.unshift(current.property.name);
            current = current.object;
          } else {
            break;
          }
        }
        return parts.join(".");
      }
      return undefined;
    }

    return {
      ImportDeclaration: handleImport,
      JSXOpeningElement(node) {
        const elementName = getElementName(node.name);
        if (!elementName) {
          return;
        }
        const propsToCheck = aliasToProps.get(elementName);
        if (!propsToCheck || propsToCheck.size === 0) {
          return;
        }
        for (const attr of node.attributes) {
          if (attr.type === "JSXSpreadAttribute") {
            context.report({
              node: attr,
              messageId: "noSpread",
              data: { component: elementName },
            });
            continue;
          }
          if (!attr.name || !propsToCheck.has(attr.name.name)) {
            continue;
          }
          if (!isStaticStringAttribute(attr)) {
            context.report({
              node: attr.value || attr,
              messageId: "onlyLiteral",
              data: { component: elementName, prop: attr.name.name },
            });
          }
        }
      },
    };
  },
};
