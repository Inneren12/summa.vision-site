#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const fsp = fs.promises;

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
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
  await fsp.rm(destination, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.cp(source, destination, { recursive: true });
}

async function main() {
  const webRoot = path.resolve(__dirname, "../apps/web");
  const standaloneDir = process.env.STANDALONE_DIR || path.join(webRoot, ".next/standalone");
  const standaloneAppDir = path.join(standaloneDir, "apps", "web");

  if (!(await pathExists(standaloneDir))) {
    console.warn(
      "[copy-standalone] No .next/standalone found. " +
        "Build is likely static or output:'standalone' is not enabled. Skipping copy (no-op).",
    );
    process.exit(0);
  }

  if (!(await pathExists(standaloneAppDir))) {
    throw new Error(`Standalone app directory not found: ${standaloneAppDir}`);
  }

  const staticSource = path.join(webRoot, ".next/static");
  const staticDestination = path.join(standaloneAppDir, ".next/static");
  const publicSource = path.resolve(__dirname, "../public");
  const publicDestination = path.join(standaloneAppDir, "public");

  await copyDirectory(staticSource, staticDestination);
  await copyDirectory(publicSource, publicDestination);
}

main().catch((error) => {
  console.error("Failed to copy standalone assets", error);
  process.exitCode = 1;
});
