#!/usr/bin/env node
/**
 * Collect Next.js build artifacts in a robust way.
 * Supports:
 *  A) standalone (node runtime): .next/standalone[/apps/web]/server.js
 *  B) serverless/edge:           .next/server + .next/static
 *  C) static-only:               only .next/static + public
 *
 * Env:
 *  - STANDALONE_OUT_DIR  — destination dir (default: <repo>/dist/artifact)
 *  - STANDALONE_APP_DIR  — override path where server.js lives (optional)
 *  - REQUIRE_SERVER      — "1" to fail if no server.js (default: "0" — no-op fallback)
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
  if (!exists(src)) return false;
  ensureDir(path.dirname(dst));
  fs.cpSync(src, dst, { recursive: true, force: true });
  return true;
};

function findStandaloneAppDir(base) {
  const override = process.env.STANDALONE_APP_DIR && path.resolve(process.env.STANDALONE_APP_DIR);
  if (override && exists(path.join(override, "server.js"))) return override;
  if (exists(path.join(base, "server.js"))) return base; // modern layout
  const mono = path.join(base, "apps", "web"); // old monorepo layout
  if (exists(path.join(mono, "server.js"))) return mono;
  // shallow scan
  if (exists(base)) {
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
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
  const outDir = process.env.STANDALONE_OUT_DIR
    ? path.resolve(process.env.STANDALONE_OUT_DIR)
    : path.join(repoRoot, "dist", "artifact");

  ensureDir(outDir);

  const standaloneBase = path.join(nextDir, "standalone");
  const staticSrc = path.join(nextDir, "static");
  const publicSrc = path.join(webRoot, "public");

  let kind = "static";
  let summary = {};

  if (exists(standaloneBase)) {
    const appDir = findStandaloneAppDir(standaloneBase);
    if (appDir) {
      // Standalone Node runtime
      kind = "standalone";
      copy(appDir, outDir);
      copy(staticSrc, path.join(outDir, ".next", "static"));
      copy(publicSrc, path.join(outDir, "public"));
      summary = { kind, appDir, outDir };
      console.log(`[copy-standalone] Collected standalone build from ${appDir} -> ${outDir}`);
    } else {
      // .next/standalone есть, но server.js не найден (нетокенный кейс)
      if (process.env.REQUIRE_SERVER === "1") {
        throw new Error("server.js not found in .next/standalone and REQUIRE_SERVER=1");
      }
      kind = "serverless";
      copy(path.join(nextDir, "server"), path.join(outDir, ".next", "server"));
      copy(staticSrc, path.join(outDir, ".next", "static"));
      copy(publicSrc, path.join(outDir, "public"));
      summary = { kind, note: "no server.js in standalone, fell back to server assets", outDir };
      console.warn(
        "[copy-standalone] No server.js under .next/standalone — copied server/static/public instead.",
      );
    }
  } else if (exists(path.join(nextDir, "server"))) {
    // Serverless/edge layout
    kind = "serverless";
    copy(path.join(nextDir, "server"), path.join(outDir, ".next", "server"));
    copy(staticSrc, path.join(outDir, ".next", "static"));
    copy(publicSrc, path.join(outDir, "public"));
    summary = { kind, outDir };
    console.log("[copy-standalone] Collected serverless/edge assets ->", outDir);
  } else {
    // Static-only: копируем что есть и выходим 0
    kind = "static";
    const staticOk = copy(staticSrc, path.join(outDir, ".next", "static"));
    const publicOk = copy(publicSrc, path.join(outDir, "public"));
    summary = { kind, staticCopied: staticOk, publicCopied: publicOk, outDir };
    console.warn(
      "[copy-standalone] No standalone/server dirs — copied only static/public (static build).",
    );
  }

  // Запишем манифест артефакта (полезно в CI)
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "artifact-manifest.json"), JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (err) {
  console.error("Failed to copy standalone assets", err);
  process.exit(1);
}
