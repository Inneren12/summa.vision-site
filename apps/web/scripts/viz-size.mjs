#!/usr/bin/env node

import { spawn } from "node:child_process";

const env = { ...process.env, NEXT_VIZ_ANALYZE: "1", NEXT_TELEMETRY_DISABLED: "1" };

const child = spawn("next", ["build"], {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
