#!/usr/bin/env node
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("tsx/cjs");

const { loadEnv } = require("../lib/env/load.ts");

try {
  const env = loadEnv();
  console.log(`[env-check] Environment OK (NODE_ENV=${env.NODE_ENV})`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[env-check] Environment invalid: ${message}`);
  process.exitCode = 1;
}
