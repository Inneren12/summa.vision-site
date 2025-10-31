#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function pathExists(targetPath) {
  if (!targetPath) {
    return false;
  }
  try {
    return fs.existsSync(targetPath);
  } catch (error) {
    return false;
  }
}

function listDirs(targetPath) {
  try {
    return fs
      .readdirSync(targetPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(targetPath, entry.name));
  } catch (error) {
    return [];
  }
}

function resolveMsPlaywrightCacheDirs() {
  const dirs = new Set();
  const home = os.homedir();
  const platform = process.platform;
  const envBrowsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;

  if (envBrowsersPath && envBrowsersPath !== "0") {
    dirs.add(path.resolve(envBrowsersPath));
  }

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    dirs.add(path.join(localAppData, "ms-playwright"));
  } else if (platform === "darwin") {
    dirs.add(path.join(home, "Library", "Caches", "ms-playwright"));
  } else {
    const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, ".cache");
    dirs.add(path.join(xdgCache, "ms-playwright"));
  }

  if (envBrowsersPath === "0") {
    const repoRoot = path.resolve(__dirname, "..");
    [
      path.join(repoRoot, "node_modules", "playwright-core", ".local-browsers"),
      path.join(repoRoot, "node_modules", "playwright", ".local-browsers"),
      path.join(repoRoot, "apps", "web", "node_modules", "playwright-core", ".local-browsers"),
      path.join(repoRoot, "apps", "web", "node_modules", "playwright", ".local-browsers"),
    ].forEach((candidate) => dirs.add(candidate));
  }

  return Array.from(dirs);
}

const skip = process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
const skipEnabled = typeof skip === "string" && skip.trim() !== "" && skip !== "0";

function hasPlaywrightBrowsers() {
  const dirs = resolveMsPlaywrightCacheDirs();
  for (const cacheDir of dirs) {
    if (!pathExists(cacheDir)) {
      continue;
    }
    const subdirs = listDirs(cacheDir);
    if (subdirs.some((subdir) => /^(chromium-|firefox-|webkit-)/.test(path.basename(subdir)))) {
      return true;
    }
    if (subdirs.length > 0) {
      return true;
    }
  }
  return false;
}

function hasSystemChrome() {
  const envCandidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ].filter(Boolean);

  if (envCandidates.some((candidate) => pathExists(candidate))) {
    return true;
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const candidates = [
      path.join(
        process.env.PROGRAMFILES || "C:\\Program Files",
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      path.join(
        process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    ];

    if (spawnSync("where", ["chrome", "chrome.exe"], { stdio: "ignore" }).status === 0) {
      return true;
    }

    return candidates.some((candidate) => pathExists(candidate));
  }

  if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      path.join(
        os.homedir(),
        "Applications",
        "Google Chrome.app",
        "Contents",
        "MacOS",
        "Google Chrome",
      ),
    ];

    if (spawnSync("which", ["google-chrome"], { stdio: "ignore" }).status === 0) {
      return true;
    }

    if (spawnSync("which", ["chrome"], { stdio: "ignore" }).status === 0) {
      return true;
    }

    return candidates.some((candidate) => pathExists(candidate));
  }

  const linuxWhichCandidates = [
    "google-chrome-stable",
    "google-chrome",
    "chromium-browser",
    "chromium",
  ];

  if (
    linuxWhichCandidates.some((bin) => spawnSync("which", [bin], { stdio: "ignore" }).status === 0)
  ) {
    return true;
  }

  const linuxKnownPaths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];

  return linuxKnownPaths.some((candidate) => pathExists(candidate));
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
  console.log("✅ System Chrome detected. You can run tests with PW_CHANNEL=chrome.");
  process.exit(0);
}

console.log(
  "❌ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set, but no cached Playwright browsers or system Chrome were found.",
);
console.error("   Fix locally with one of the following:");
console.error("     - Install Playwright browsers (recommended):");
console.error("         npx -y @playwright/test@1.48.0 install chrome");
console.error("     - Or unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD and re-run this script");
console.error(
  "     - Or set CHROME_PATH/PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to your Chrome binary",
);
console.error("   See docs/dev/e2e.md for more details.");
process.exit(1);
