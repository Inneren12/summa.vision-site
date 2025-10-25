#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const cookieInputs = [];

async function gatherFromStdin() {
  const chunks = [];
  return new Promise((resolve) => {
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.resume();
  });
}

async function resolveInputs() {
  if (args.length === 0) {
    const stdin = await gatherFromStdin();
    if (stdin.trim()) {
      cookieInputs.push(...stdin.trim().split(/\r?\n/).filter(Boolean));
    }
    return;
  }

  for (const arg of args) {
    if (arg === "-" || arg === "--") {
      const stdin = await gatherFromStdin();
      if (stdin.trim()) {
        cookieInputs.push(...stdin.trim().split(/\r?\n/).filter(Boolean));
      }
      continue;
    }
    try {
      const data = await readFile(arg, "utf8");
      cookieInputs.push(...data.split(/\r?\n/).filter(Boolean));
    } catch {
      cookieInputs.push(arg);
    }
  }
}

function parseCookies(header) {
  const pairs = header.split(/;\s*/);
  const cookies = new Map();
  for (const part of pairs) {
    const [name, ...rest] = part.split("=");
    if (!name) continue;
    const value = rest.join("=");
    cookies.set(name.trim(), value);
  }
  return cookies;
}

function checkCookies() {
  if (cookieInputs.length === 0) {
    console.log("No cookie inputs provided. Pass cookie headers via stdin or arguments.");
    return;
  }
  let missing = 0;
  cookieInputs.forEach((header, idx) => {
    const cookies = parseCookies(header);
    if (!cookies.get("ff_aid")) {
      missing += 1;
      console.warn(`WARN[${idx}]: ff_aid cookie missing in header: ${header}`);
    }
  });
  if (missing === 0) {
    console.log(`All ${cookieInputs.length} cookie header(s) include ff_aid.`);
  } else {
    console.log(
      `${missing} of ${cookieInputs.length} cookie header(s) are missing ff_aid. Ensure migration sets ff_aid for legacy seeds.`,
    );
  }
}

await resolveInputs();
checkCookies();
