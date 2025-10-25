#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const targets = new Set([
  "node_modules",
  ".next/cache",
  "apps/web/node_modules",
  "apps/web/.next/cache",
]);

for (const target of targets) {
  const absolute = resolve(cwd, target);
  if (existsSync(absolute)) {
    console.log(`Removing ${absolute}`);
    rmSync(absolute, { recursive: true, force: true });
  }
}

let storePath = "";
try {
  storePath = execSync("pnpm store path", { encoding: "utf8" }).trim();
} catch (error) {
  console.warn("Unable to resolve pnpm store path:", error.message);
}

const isExpectedStorePath = /\/pnpm\//.test(storePath) || storePath.includes(".pnpm-store");

if (storePath && isExpectedStorePath) {
  console.log(`Removing pnpm store at ${storePath}`);
  try {
    rmSync(storePath, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      "Failed to remove pnpm store directory directly, falling back to pnpm store prune",
    );
    try {
      execSync("pnpm store prune", { stdio: "inherit" });
    } catch (pruneError) {
      console.warn("pnpm store prune failed:", pruneError.message);
    }
  }
} else if (storePath) {
  console.warn(`Refusing to remove unexpected pnpm store path: ${storePath}`);
}

console.log("Cache cleanup complete.");
