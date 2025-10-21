module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "unused-imports", "import"],
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  ignorePatterns: ["dist", ".next", "**/generated/**"],
  rules: {
    "unused-imports/no-unused-imports": "error",
    "import/order": [
      "error",
      {
        alphabetize: { order: "asc" },
        "newlines-between": "always",
      },
    ],
    "@next/next/no-html-link-for-pages": "off",
  },
  overrides: [
    {
      files: ["**/*.cjs", "**/*.mjs"],
      env: {
        node: true,
      },
      parserOptions: {
        sourceType: "script",
      },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
