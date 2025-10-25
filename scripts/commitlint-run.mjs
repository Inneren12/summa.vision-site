#!/usr/bin/env node
/**
Smart commitlint launcher for both local and CI.

Usage:

Locally (husky commit-msg): falls back to editing file

CI: set COMMITLINT_FROM and COMMITLINT_TO to lint a range

Env:

COMMITLINT_FROM, COMMITLINT_TO (optional range)

COMMITLINT_BREAKGLASS=true (skip lint in emergencies)

*/
import { spawnSync } from "node:child_process";

if (process.env.COMMITLINT_BREAKGLASS === "true") {
  process.exit(0);
}

const from = process.env.COMMITLINT_FROM;
const to = process.env.COMMITLINT_TO;

const args = from && to ? ["--from", from, "--to", to] : ["-e", ".git/COMMIT_EDITMSG"];

const r = spawnSync("npx", ["--no-install", "commitlint", ...args], {
  stdio: "inherit",
  shell: true,
});

process.exit(r.status ?? 0);
