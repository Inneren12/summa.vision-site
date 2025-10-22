#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

const files = [
  "dist/lib/format-cli-help-output.js",
  "dist/lib/format-dynamic-import-path.js",
  "dist/telemetry/flush-and-exit.js",
  "dist/build/manifests/formatter/format-manifest.js",
  "dist/build/webpack/plugins/font-stylesheet-gathering-plugin.js",
  "dist/build/webpack/plugins/flight-manifest-plugin.js",
  "dist/esm/lib/format-cli-help-output.js",
  "dist/esm/lib/format-dynamic-import-path.js",
  "dist/esm/server/font-utils.js",
  "dist/esm/server/app-render/flight-render-result.js",
  "dist/esm/server/lib/format-hostname.js",
  "dist/esm/shared/lib/fnv1a.js",
  "dist/esm/build/webpack/plugins/flight-client-entry-plugin.js",
  "dist/esm/build/webpack/plugins/font-stylesheet-gathering-plugin.js",
  "dist/esm/build/webpack/plugins/flight-manifest-plugin.js",
  "dist/server/font-utils.js",
  "dist/server/app-render/flight-render-result.js",
  "dist/server/lib/format-hostname.js",
  "dist/shared/lib/fnv1a.js",
];

async function applyPatches() {
  const base = path.join(__dirname, "..", "patches", "next");
  const targetBase = path.join(__dirname, "..", "node_modules", "next");

  for (const relativePath of files) {
    const source = path.join(base, relativePath);
    const target = path.join(targetBase, relativePath);

    try {
      await fs.access(target);
      continue;
    } catch {
      try {
        await fs.mkdir(path.dirname(target), { recursive: true });
        const content = await fs.readFile(source);
        await fs.writeFile(target, content);
        console.log("Patched missing Next file:", relativePath);
      } catch (error) {
        console.warn("Failed to patch Next file", relativePath, error);
      }
    }
  }
}

applyPatches().catch((error) => {
  console.warn("Failed to apply Next patches", error);
});
