import { spawnSync } from "node:child_process";
if (process.env.COMMITLINT_BREAKGLASS === "true") process.exit(0);
const from = process.env.COMMITLINT_FROM;
const to = process.env.COMMITLINT_TO;
const args = from && to ? ["--from", from, "--to", to] : ["-e", ".git/COMMIT_EDITMSG"];
const r = spawnSync("npx", ["--no-install", "commitlint", ...args], {
  stdio: "inherit",
  shell: true,
});
process.exit(r.status ?? 0);
