#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { glob } from "glob";

import {
  RolloutPolicySchema,
  formatRolloutPolicyIssues,
  RolloutPolicyValidationError,
  parseRolloutPolicy,
} from "../lib/ff/policy/schema.mjs";

export interface ValidationResult {
  file: string;
  valid: boolean;
  message?: string;
}

async function expandPatterns(patterns: string[]): Promise<string[]> {
  const expanded = new Set<string>();
  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true, absolute: true });
    if (matches.length === 0) {
      if (/[*?[\]]/.test(pattern)) {
        continue;
      }
      expanded.add(resolve(pattern));
      continue;
    }
    for (const match of matches) {
      expanded.add(resolve(match));
    }
  }
  return Array.from(expanded);
}

async function validateFile(file: string): Promise<ValidationResult> {
  try {
    const raw = await readFile(file, "utf8");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      return {
        file,
        valid: false,
        message: `Invalid JSON: ${(error as Error).message}`,
      };
    }

    const result = RolloutPolicySchema.safeParse(json);
    if (!result.success) {
      return {
        file,
        valid: false,
        message: formatRolloutPolicyIssues(result.error.issues),
      };
    }

    // parse to ensure normalization and throw consistent error if needed
    parseRolloutPolicy(json);

    return { file, valid: true };
  } catch (error) {
    if (error instanceof RolloutPolicyValidationError) {
      return {
        file,
        valid: false,
        message: formatRolloutPolicyIssues(error.issues),
      };
    }
    return {
      file,
      valid: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function validatePolicies(patterns: string[]): Promise<ValidationResult[]> {
  const inputs = patterns.length ? patterns : ["policies/**/*.json"];
  const files = await expandPatterns(inputs);
  const unique = files.filter((file, index, arr) => arr.indexOf(file) === index);

  const stats = await Promise.all(
    unique.map(async (file) => {
      const result = await validateFile(file);
      return result;
    }),
  );

  return stats;
}

async function main() {
  const results = await validatePolicies(process.argv.slice(2));
  const cwd = process.cwd();

  const checked = results.filter((result) => result.valid);
  const invalid = results.filter((result) => !result.valid);

  if (results.length === 0) {
    console.log("No rollout policy files matched; nothing to validate.");
    return;
  }

  for (const result of results) {
    const rel = relative(cwd, result.file);
    if (result.valid) {
      console.log(`✔ ${rel}`);
    } else {
      console.error(`✖ ${rel}`);
      if (result.message) {
        console.error(result.message);
      }
    }
  }

  if (invalid.length > 0) {
    const summary = invalid.map((item) => relative(cwd, item.file)).join(", ");
    throw new Error(`Failed to validate rollout policies: ${summary}`);
  }

  if (checked.length > 0) {
    console.log(`Validated ${checked.length} rollout polic${checked.length === 1 ? "y" : "ies"}.`);
  }
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
