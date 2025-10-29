#!/usr/bin/env node
// Robust copy of Next build artifacts: handles standalone, serverless/edge, and static.
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
  const over = process.env.STANDALONE_APP_DIR && path.resolve(process.env.STANDALONE_APP_DIR);
  if (over && exists(path.join(over, "server.js"))) return over;
  if (exists(path.join(base, "server.js"))) return base; // modern
  const mono = path.join(base, "apps", "web"); // old monorepo
  if (exists(path.join(mono, "server.js"))) return mono;
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
  const repo = path.resolve(__dirname, "..");
  const web = path.join(repo, "apps", "web");
  const next = path.join(web, ".next");
  const standaloneBase = path.join(next, "standalone");
  const out = path.resolve(process.env.STANDALONE_OUT_DIR || path.join(repo, "dist", "artifact"));
  ensureDir(out);

  const staticSrc = path.join(next, "static");
  const publicSrc = path.join(web, "public");

  if (exists(standaloneBase)) {
    const appDir = findStandaloneAppDir(standaloneBase);
    if (appDir) {
      copy(appDir, out);
      copy(staticSrc, path.join(out, ".next", "static"));
      copy(publicSrc, path.join(out, "public"));
      console.log(`[copy-standalone] Collected standalone from ${appDir} -> ${out}`);
      return;
    }
    if (process.env.REQUIRE_SERVER === "1") {
      throw new Error("server.js not found in .next/standalone and REQUIRE_SERVER=1");
    }
    // fallback: serverless/edge artifacts if present
    copy(path.join(next, "server"), path.join(out, ".next", "server"));
    copy(staticSrc, path.join(out, ".next", "static"));
    copy(publicSrc, path.join(out, "public"));
    console.warn(
      "[copy-standalone] No server.js in standalone — copied server/static/public instead.",
    );
    return;
  }

  // No standalone: serverless or static
  const hadServer = copy(path.join(next, "server"), path.join(out, ".next", "server"));
  const hadStatic = copy(staticSrc, path.join(out, ".next", "static"));
  const hadPublic = copy(publicSrc, path.join(out, "public"));
  console.log(
    `[copy-standalone] Collected ${hadServer ? "serverless " : ""}${hadStatic ? "static " : ""}assets -> ${out}`,
  );
}

try {
  main();
} catch (e) {
  console.error("Failed to copy standalone assets", e);
  process.exit(1);
}
