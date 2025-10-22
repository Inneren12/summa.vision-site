import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "apps/web/.next/analyze");
const targetDir = resolve(rootDir, "reports/perf/bundle");

if (!existsSync(sourceDir)) {
  console.error("Bundle analyzer output not found at", sourceDir);
  process.exit(1);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Bundle analyzer reports copied to ${targetDir}`);
