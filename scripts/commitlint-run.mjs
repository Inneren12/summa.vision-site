#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.COMMITLINT_BREAKGLASS === "true") process.exit(0);

// 1) читаем из CLI (--from/--to), затем из ENV
let from = process.env.COMMITLINT_FROM || undefined;
let to = process.env.COMMITLINT_TO || undefined;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const k = argv[i];
  if (k === "--from" && argv[i + 1]) {
    from = argv[i + 1];
    i++;
  } else if (k === "--to" && argv[i + 1]) {
    to = argv[i + 1];
    i++;
  }
}

// 2) собираем аргументы для commitlint
let args = [];
if (from && to) {
  args = ["--from", from, "--to", to];
} else {
  // если нет диапазона: сначала пробуем edit-файл, иначе HEAD^..HEAD
  const editPath = ".git/COMMIT_EDITMSG";
  if (existsSync(editPath)) {
    args = ["-e", editPath];
  } else {
    const git = (a) => spawnSync("git", a, { encoding: "utf8" });
    const head = git(["rev-parse", "HEAD"]).stdout.trim();
    const parent = (git(["rev-parse", "HEAD^"]).stdout || "").trim() || head;
    args = ["--from", parent, "--to", head];
  }
}

// 3) запускаем локальный commitlint
const r = spawnSync("npx", ["--no-install", "commitlint", ...args], {
  stdio: "inherit",
  shell: true,
});
process.exit(r.status ?? 0);
