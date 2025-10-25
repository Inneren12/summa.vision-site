#!/usr/bin/env node
import process from "node:process";

import { validateStories } from "../lib/content/stories/validator.mjs";

try {
  const result = await validateStories();
  if (!result.ok) {
    console.error("Story validation failed:\n");
    for (const error of result.errors) {
      console.error(`- ${error.file}: ${error.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Stories look good (${result.errors.length} issues).`);
  }
} catch (error) {
  console.error("Failed to validate stories.");
  console.error(error);
  process.exitCode = 1;
}
