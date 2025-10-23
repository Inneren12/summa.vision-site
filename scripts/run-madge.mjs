import { spawnSync } from "node:child_process";

import config from "../madge.config.mjs";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["-y", "madge@6.1.0"];

const targets =
  Array.isArray(config.paths) && config.paths.length > 0 ? config.paths : ["apps/web"];
args.push(...targets);

args.push("--circular");

if (Array.isArray(config.fileExtensions) && config.fileExtensions.length > 0) {
  args.push("--extensions", config.fileExtensions.join(","));
}

if (config.tsConfig) {
  args.push("--ts-config", config.tsConfig);
}

if (config.baseDir) {
  args.push("--basedir", config.baseDir);
}

const result = spawnSync(npxCommand, args, { stdio: "inherit" });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
