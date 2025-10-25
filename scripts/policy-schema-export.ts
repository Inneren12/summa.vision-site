#!/usr/bin/env tsx
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { zodToJsonSchema } from "zod-to-json-schema";

import { RolloutPolicySchema } from "../lib/ff/policy/schema.mjs";

async function main() {
  const jsonSchema = zodToJsonSchema(RolloutPolicySchema, "RolloutPolicy", {
    target: "jsonSchema7",
    $refStrategy: "none",
  });

  const outputPath = resolve(process.cwd(), "rollout-policy.schema.json");
  const serialized = `${JSON.stringify(jsonSchema, null, 2)}\n`;
  await writeFile(outputPath, serialized, "utf8");
  console.log(`Exported rollout policy schema to ${outputPath}`);
}

const runAsCli = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
};

if (runAsCli()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
