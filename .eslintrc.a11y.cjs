module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["jsx-a11y", "react-hooks"],
  extends: ["plugin:jsx-a11y/strict"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // Autofocus is allowed on non-DOM components like Radix portals.
    "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
    "react-hooks/rules-of-hooks": "off",
    "react-hooks/exhaustive-deps": "off",
  },
  ignorePatterns: ["**/generated/**", "**/*.stories.tsx", "**/*.stories.mdx"],
};
