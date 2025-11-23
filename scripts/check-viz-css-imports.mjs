#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const ROOT = path.resolve(process.cwd());
const WEB_ROOT = path.join(ROOT, "apps", "web");
const ALLOWED_MAPLIBRE = path.join(WEB_ROOT, "app", "layout.tsx");
const MAPLIBRE_SPEC = "maplibre-gl/dist/maplibre-gl.css";
const BANNED_VIZ_LIBS = [
  "echarts",
  "vega",
  "vega-lite",
  "vega-embed",
  "vega-tooltip",
  "deck.gl",
  "@deck.gl",
  "visx",
];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function findLineNumber(content, needle) {
  const index = content.indexOf(needle);
  if (index === -1) return "?";
  return content.slice(0, index).split(/\r?\n/).length;
}

async function main() {
  const files = await glob("apps/web/**/*.{ts,tsx,js,jsx,mts,cts}", { absolute: true });
  const violations = [];

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const relPath = toPosix(path.relative(ROOT, file));

    const staticImportRegex = /import\s+(?:[^"']*from\s*)?["']([^"']+\.css)["']/g;
    const dynamicImportRegex = /import\s*\(\s*["']([^"']+\.css)["']\s*\)/g;

    const cssSpecifiers = [];
    for (const match of source.matchAll(staticImportRegex)) {
      cssSpecifiers.push(match[1]);
    }
    for (const match of source.matchAll(dynamicImportRegex)) {
      cssSpecifiers.push(match[1]);
    }

    for (const specifier of cssSpecifiers) {
      if (specifier === MAPLIBRE_SPEC) {
        if (path.resolve(file) !== ALLOWED_MAPLIBRE) {
          const line = findLineNumber(source, specifier);
          violations.push(
            `${relPath}:${line} — MapLibre CSS is only allowed in apps/web/app/layout.tsx`,
          );
        }
        continue;
      }
      const lower = specifier.toLowerCase();
      const isExternal =
        !specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("@/");
      const matchesBannedLib = BANNED_VIZ_LIBS.some((lib) => lower.includes(lib));
      if (isExternal && matchesBannedLib) {
        const line = findLineNumber(source, specifier);
        violations.push(
          `${relPath}:${line} — Global CSS imports from viz libraries are forbidden (${specifier})`,
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error("\nVisualization CSS guard failed:\n");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error("\nFix the imports or move styles into scoped project-owned files.\n");
    process.exit(1);
  }

  console.log("Visualization CSS imports look good (S7-95, Pattern A).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
