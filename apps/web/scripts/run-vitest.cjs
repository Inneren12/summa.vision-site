#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");
const args = process.argv.slice(2);
const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
const configPath = path.resolve(__dirname, "../vitest.config.ts");
const child = spawn(cmd, ["-y", "vitest@1.6.0", "run", "-c", configPath, ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, CI: "1" },
});
child.on("exit", (code) => process.exit(code ?? 1));
