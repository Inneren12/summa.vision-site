const fs = require("fs");
const path = require("path");

const srcTokens = path.join(__dirname, "..", "styles", "tokens.css");
const srcTypography = path.join(__dirname, "..", "styles", "typography.css");
const destDir = path.join(__dirname, "..", "apps", "web", "app");

fs.mkdirSync(destDir, { recursive: true });

const copyWithTransform = (source, target, transform) => {
  if (!fs.existsSync(source)) {
    console.error("Missing", source);
    process.exit(2);
  }

  const raw = fs.readFileSync(source, "utf8");
  const next = typeof transform === "function" ? transform(raw) : raw;
  fs.writeFileSync(target, next, "utf8");
};

copyWithTransform(srcTokens, path.join(destDir, "tokens.css"));
copyWithTransform(srcTypography, path.join(destDir, "typography.css"), (css) => {
  if (css.startsWith("@tailwind base")) {
    return css;
  }

  const prefix = "@tailwind base;\n@tailwind components;\n\n";
  return `${prefix}${css}`;
});

console.log("Token CSS copied to apps/web/app/");
