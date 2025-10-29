#!/usr/bin/env node
/* Robust copy of Next.js standalone output.
 * Supports both layouts:
 *   A) apps/web/.next/standalone/server.js
 *   B) apps/web/.next/standalone/apps/web/server.js
 * If standalone is missing (static/edge build) — no-op.
 * Env:
 *   STANDALONE_APP_DIR  — override path to app dir (where server.js lives)
 *   STANDALONE_OUT_DIR  — override destination (default: <repo>/dist/standalone)
 */
const fs = require("fs");
const path = require("path");

const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const copy = (src, dst) => {
  if (!exists(src)) return;
  ensureDir(path.dirname(dst));
  fs.cpSync(src, dst, { recursive: true, force: true });
};

function findStandaloneAppDir(base) {
  const override = process.env.STANDALONE_APP_DIR && path.resolve(process.env.STANDALONE_APP_DIR);
  if (override && exists(path.join(override, "server.js"))) return override;
  if (exists(path.join(base, "server.js"))) return base; // modern layout
  const mono = path.join(base, "apps", "web"); // old monorepo layout
  if (exists(path.join(mono, "server.js"))) return mono;
  // scan one level for server.js
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const cand = path.join(base, e.name);
      if (exists(path.join(cand, "server.js"))) return cand;
    }
  }
  return null;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const webRoot = path.join(repoRoot, "apps", "web");
  const nextDir = path.join(webRoot, ".next");
  const standaloneBase = path.join(nextDir, "standalone");

  if (!exists(standaloneBase)) {
    console.warn("[copy-standalone] No .next/standalone found (static/edge build). Skipping.");
    process.exit(0);
  }
  const appDir = findStandaloneAppDir(standaloneBase);
  if (!appDir) {
    console.warn(
      `[copy-standalone] Standalone app directory not found under ${standaloneBase}. Skipping.`,
    );
    process.exit(0);
  }

  const outDir = process.env.STANDALONE_OUT_DIR
    ? path.resolve(process.env.STANDALONE_OUT_DIR)
    : path.join(repoRoot, "dist", "standalone");
  ensureDir(outDir);

  // Copy minimal server app (where server.js lives)
  copy(appDir, outDir);

  // Copy .next/static alongside server.js
  const staticSrc = path.join(nextDir, "static");
  const staticDest = path.join(outDir, ".next", "static");
  copy(staticSrc, staticDest);

  // Copy public assets (optional but useful)
  const publicSrc = path.join(webRoot, "public");
  const publicDest = path.join(outDir, "public");
  copy(publicSrc, publicDest);

  console.log(`[copy-standalone] Copied standalone to ${outDir}`);
}

try {
  main();
} catch (err) {
  console.error("Failed to copy standalone assets", err);
  process.exit(1);
}
