#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".next", "coverage"]);
const ALLOWED_PATHS = [
  path.join(ROOT, "tokens"),
  path.join(ROOT, "styles", "tokens.css"),
  path.join(ROOT, "src", "shared", "theme", "tokens.ts"),
  path.join(ROOT, "package-lock.json"),
  path.join(ROOT, "public"),
  path.join(ROOT, "apps", "web", "app", "tokens.css"),
  path.join(ROOT, "apps", "web", "app", "typography.css"),
  path.join(ROOT, "apps", "web", "tailwind.config.ts"),
];
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".ico",
  ".svg",
  ".pdf",
]);

const COLOR_REGEX = /#([0-9a-fA-F]{3,8})\b|rgba?\(|hsla?\(/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const issues = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      issues.push(...(await walk(fullPath)));
      continue;
    }

    if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    if (ALLOWED_PATHS.some((allowed) => fullPath.startsWith(allowed))) {
      continue;
    }

    const contents = await readFile(fullPath, "utf8");
    const matches = contents.match(COLOR_REGEX);
    if (matches) {
      issues.push({ file: path.relative(ROOT, fullPath), matches: Array.from(new Set(matches)) });
    }
  }

  return issues;
}

async function main() {
  const issues = await walk(ROOT);
  if (issues.length > 0) {
    // eslint-disable-next-line no-console
    console.error("Raw color values detected outside token sources:");
    issues.forEach((issue) => {
      // eslint-disable-next-line no-console
      console.error(`- ${issue.file}: ${issue.matches.join(", ")}`);
    });
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log("No raw color literals detected.");
}

void main();
