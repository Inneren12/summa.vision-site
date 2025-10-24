import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

const ROOT = process.cwd();
const CLIENT_EXTENSIONS = new Set([".client.ts", ".client.tsx"]);
const FORBIDDEN_PATTERNS = [/\/lib\/.*\/server(?:\/|$)/, /\/lib\/env\.server(?:\/|$)/];

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(absolute));
    } else {
      files.push(absolute);
    }
  }

  return files;
}

function isClientFile(file: string): boolean {
  return CLIENT_EXTENSIONS.has(path.extname(file));
}

function extractImports(source: string): string[] {
  const matches: string[] = [];
  const importRe = /import\s+(?:[^'";]+?from\s+)?["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;

  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source))) {
    matches.push(match[1]);
  }
  while ((match = requireRe.exec(source))) {
    matches.push(match[1]);
  }

  return matches;
}

describe("no server imports in client files (*.client.tsx/ts)", () => {
  const clientFiles = walk(ROOT).filter(isClientFile);
  const offenders: Array<{ file: string; specifier: string }> = [];

  for (const file of clientFiles) {
    const source = fs.readFileSync(file, "utf8");
    const specifiers = extractImports(source);

    for (const specifier of specifiers) {
      const hitsForbidden =
        specifier === "server-only" ||
        FORBIDDEN_PATTERNS.some((pattern) => pattern.test(specifier));

      if (hitsForbidden) {
        offenders.push({ file: path.relative(ROOT, file), specifier });
      }
    }
  }

  it("has no forbidden imports in client files", () => {
    const details = offenders.map(({ file, specifier }) => `${file} → ${specifier}`).join("\n");

    expect(details).toBe("");
  });
});
