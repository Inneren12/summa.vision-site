#!/usr/bin/env node

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { exit } from "node:process";

import YAML from "yaml";

const HELP =
  `Usage: node scripts/data_changelog.mjs <base-ref> [head-ref]\n\n` +
  `Compares data/catalog.yml between two git revisions and writes reports/datasets-changelog.txt.`;

const OUTPUT_FILE = path.resolve("reports", "datasets-changelog.txt");
const CATALOG_PATH = "data/catalog.yml";

function parseArgs(argv) {
  const positional = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      exit(0);
    }
    positional.push(arg);
  }
  if (positional.length === 0) {
    console.error(HELP);
    exit(1);
  }
  const [baseRef, headRef = "HEAD"] = positional;
  return { baseRef, headRef };
}

async function gitShow(ref, file) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["show", `${ref}:${file}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const normalized = stderr.trim();
      if (normalized.includes("exists on disk") || normalized.includes("does not exist")) {
        resolve(null);
        return;
      }
      reject(new Error(normalized || `git show exited with code ${code}`));
    });
  });
}

async function gitRevParse(ref) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["rev-parse", "--short", ref], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `git rev-parse exited with code ${code}`));
    });
  });
}

function parseCatalog(raw) {
  if (!raw) return new Map();
  let parsed;
  try {
    parsed = YAML.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${CATALOG_PATH}: ${error.message}`);
  }
  const datasets = Array.isArray(parsed?.datasets) ? parsed.datasets : [];
  const map = new Map();
  for (const entry of datasets) {
    if (!entry || typeof entry !== "object") continue;
    const id = entry.id ?? entry.slug ?? null;
    if (!id || map.has(id)) continue;
    map.set(id, {
      id,
      title:
        typeof entry.title === "string" && entry.title.trim().length > 0
          ? entry.title.trim()
          : null,
    });
  }
  return map;
}

function formatSection(title, items, formatter) {
  const lines = [];
  lines.push(`${title} (${items.length})`);
  if (items.length === 0) {
    lines.push("- none");
    return lines;
  }
  for (const item of items) {
    lines.push(`- ${formatter(item)}`);
  }
  return lines;
}

function buildReport({ baseLabel, headLabel, added, removed }) {
  const lines = [];
  lines.push("Datasets catalog changelog");
  lines.push("===========================");
  lines.push("");
  lines.push(`Base revision: ${baseLabel}`);
  lines.push(`Head revision: ${headLabel}`);
  lines.push("");
  lines.push(
    ...formatSection("Added", added, (item) => {
      if (item.title) {
        return `${item.id} — "${item.title}"`;
      }
      return item.id;
    }),
  );
  lines.push("");
  lines.push(
    ...formatSection("Removed", removed, (item) => {
      if (item.title) {
        return `${item.id} — "${item.title}"`;
      }
      return item.id;
    }),
  );
  lines.push("");
  lines.push("Note: dataset renames appear as a removal followed by an addition.");
  lines.push("");
  return `${lines.join("\n")}`;
}

async function main() {
  const { baseRef, headRef } = parseArgs(process.argv.slice(2));
  const [baseContent, headContent] = await Promise.all([
    gitShow(baseRef, CATALOG_PATH),
    gitShow(headRef, CATALOG_PATH),
  ]);
  const baseMap = parseCatalog(baseContent);
  const headMap = parseCatalog(headContent);

  const added = [];
  const removed = [];

  for (const [id, entry] of headMap.entries()) {
    if (!baseMap.has(id)) {
      added.push(entry);
    }
  }

  for (const [id, entry] of baseMap.entries()) {
    if (!headMap.has(id)) {
      removed.push(entry);
    }
  }

  added.sort((a, b) => a.id.localeCompare(b.id));
  removed.sort((a, b) => a.id.localeCompare(b.id));

  const [baseLabel, headLabel] = await Promise.all([
    gitRevParse(baseRef).catch(() => baseRef),
    gitRevParse(headRef).catch(() => headRef),
  ]);

  const report = buildReport({ baseLabel, headLabel, added, removed });
  await writeFile(OUTPUT_FILE, `${report}\n`, "utf8");
  console.log(`datasets changelog written to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error.message || error);
  exit(1);
});
