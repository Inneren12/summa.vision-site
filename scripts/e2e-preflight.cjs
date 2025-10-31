#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const skip = process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
const skipEnabled = typeof skip === "string" && skip.trim() !== "" && skip !== "0";

function hasPlaywrightBrowsers() {
  try {
    const baseDir = path.join(os.homedir(), ".cache", "ms-playwright");
    if (!fs.existsSync(baseDir)) {
      return false;
    }
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory());
  } catch (error) {
    return false;
  }
}

function hasSystemChrome() {
  if (process.platform === "win32") {
    const where = spawnSync("where", ["chrome", "chrome.exe"], { stdio: "ignore" });
    return where.status === 0;
  }

  const candidates = ["google-chrome", "chromium", "chromium-browser", "chrome"];
  return candidates.some((bin) => spawnSync("which", [bin], { stdio: "ignore" }).status === 0);
}

const browsersInstalled = hasPlaywrightBrowsers();
const chromeAvailable = hasSystemChrome();

if (!skipEnabled) {
  console.log(
    "✅ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is not set — Playwright can download browsers on demand.",
  );
  if (!browsersInstalled) {
    console.log(
      "ℹ️  No cached Playwright browsers detected yet. They will be downloaded automatically on the first run.",
    );
  }
  process.exit(0);
}

console.log(
  "ℹ️  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is enabled. Playwright will NOT download browsers automatically.",
);

if (browsersInstalled) {
  console.log("✅ Playwright-managed browsers are already cached locally.");
  process.exit(0);
}

if (chromeAvailable) {
  console.log("✅ System Chrome detected in PATH. You can run tests with PW_CHANNEL=chrome.");
  process.exit(0);
}

console.log(
  "❌ No Playwright browsers or system Chrome detected. Install one of them before running tests.",
);
console.log("   See docs/dev/e2e.md for setup options.");
process.exit(1);
