#!/usr/bin/env node
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";

const cwd = process.cwd();
const metadata = {
  os: `${os.platform()} ${os.release()}`,
  node: process.version,
  pnpm: null,
  lockfiles: [],
};

try {
  metadata.pnpm = execSync("pnpm --version", { encoding: "utf8" }).trim();
} catch (error) {
  metadata.pnpm = "unavailable";
}

const lockCandidates = ["pnpm-lock.yaml", "package-lock.json"];
for (const file of lockCandidates) {
  if (!existsSync(`${cwd}/${file}`)) continue;
  const content = readFileSync(`${cwd}/${file}`);
  const hash = createHash("sha256").update(content).digest("hex");
  metadata.lockfiles.push({ name: file, hash });
}

if (metadata.lockfiles.length === 0) {
  metadata.lockfiles.push({ name: "lockfile", hash: "missing" });
}

const fingerprintSource = JSON.stringify({
  os: metadata.os,
  node: metadata.node,
  pnpm: metadata.pnpm,
  lockfiles: metadata.lockfiles,
});
const fingerprint = createHash("sha256").update(fingerprintSource).digest("hex");

console.log("CI environment fingerprint");
console.log("---------------------------");
console.log(`OS:    ${metadata.os}`);
console.log(`Node:  ${metadata.node}`);
console.log(`pnpm:  ${metadata.pnpm}`);
for (const lock of metadata.lockfiles) {
  console.log(`Lock:  ${lock.name} ${lock.hash}`);
}
console.log(`Fingerprint: ${fingerprint}`);
