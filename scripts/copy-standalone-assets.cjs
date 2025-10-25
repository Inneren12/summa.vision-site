#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function copyDirectory(source, destination) {
  if (!(await pathExists(source))) {
    throw new Error(`Source directory not found: ${source}`);
  }
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
}

async function main() {
  const rootDir = process.cwd();
  const standaloneRoot = path.join(rootDir, "apps", "web", ".next", "standalone", "apps", "web");

  if (!(await pathExists(standaloneRoot))) {
    throw new Error("Standalone output directory was not found. Run `npm run web:build` first.");
  }

  const staticSource = path.join(rootDir, "apps", "web", ".next", "static");
  const staticDestination = path.join(standaloneRoot, ".next", "static");
  const publicSource = path.join(rootDir, "public");
  const publicDestination = path.join(standaloneRoot, "public");

  await copyDirectory(staticSource, staticDestination);
  await copyDirectory(publicSource, publicDestination);
}

main().catch((error) => {
  console.error("Failed to copy standalone assets", error);
  process.exitCode = 1;
});
