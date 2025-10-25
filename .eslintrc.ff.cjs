module.exports = {
  root: false,
  env: {
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["ff-safe"],
  extends: ["plugin:ff-safe/recommended"],
};
