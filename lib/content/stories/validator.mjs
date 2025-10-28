import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { normalizeStoryFrontMatter } from "./schema.mjs";

const STEP_TAG_REGEX = /<Step\b([^>]*)>/g;
const ID_ATTR_REGEX =
  /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|{`([^`]+)`}|{"([^"]+)"}|{'([^']+)'}|{\"([^\"]+)\"}|{\'([^\']+)\'})/;

/**
 * Extracts Step component ids from the MDX source.
 * @param {string} source
 * @returns {{ ids: Array<{ id: string; line: number }>; errors: string[] }}
 */
export function extractStepIds(source) {
  const ids = [];
  const errors = [];
  let match;
  while ((match = STEP_TAG_REGEX.exec(source)) !== null) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(ID_ATTR_REGEX);
    if (!idMatch) {
      const line = source.slice(0, match.index).split("\n").length;
      errors.push(`Step without id attribute near line ${line}`);
      continue;
    }
    const id =
      idMatch[1] ||
      idMatch[2] ||
      idMatch[3] ||
      idMatch[4] ||
      idMatch[5] ||
      idMatch[6] ||
      idMatch[7];
    if (!id) {
      const line = source.slice(0, match.index).split("\n").length;
      errors.push(`Unable to parse static id value near line ${line}`);
      continue;
    }
    const line = source.slice(0, match.index).split("\n").length;
    ids.push({ id, line });
  }
  return { ids, errors };
}

/**
 * @typedef {Object} StoryValidationError
 * @property {string} file
 * @property {string} message
 */

/**
 * @typedef {Object} StoryValidationResult
 * @property {boolean} ok
 * @property {StoryValidationError[]} errors
 */

/**
 * Validates stories inside the provided directory.
 * @param {{ storiesDir?: string }} [options]
 * @returns {Promise<StoryValidationResult>}
 */
export async function validateStories(options = {}) {
  const storiesDir = options.storiesDir ?? path.join(process.cwd(), "content", "stories");
  const errors = [];
  let dirEntries;

  try {
    dirEntries = await fs.readdir(storiesDir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { ok: true, errors: [] };
    }
    throw error;
  }

  const slugs = new Map();

  for (const entry of dirEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".mdx")) {
      continue;
    }

    const filePath = path.join(storiesDir, entry.name);
    const relativePath = path.relative(process.cwd(), filePath);
    const fileContents = await fs.readFile(filePath, "utf8");
    const { data: frontMatter, content } = matter(fileContents);

    let normalized;
    try {
      normalized = normalizeStoryFrontMatter(frontMatter, relativePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lines = message.split("\n").filter(Boolean);
      if (lines.length === 0) {
        errors.push({ file: relativePath, message: message || "Unknown validation error" });
      } else {
        for (const line of lines) {
          errors.push({ file: relativePath, message: line });
        }
      }
      continue;
    }

    if (slugs.has(normalized.slug)) {
      const otherFile = slugs.get(normalized.slug);
      errors.push({
        file: relativePath,
        message: `slug "${normalized.slug}" is already used in ${otherFile}`,
      });
    } else {
      slugs.set(normalized.slug, relativePath);
    }

    const { ids: stepIds, errors: extractionErrors } = extractStepIds(content);
    for (const extractionError of extractionErrors) {
      errors.push({ file: relativePath, message: extractionError });
    }

    const missingSteps = normalized.steps.filter(
      (step) => !stepIds.some((node) => node.id === step.id),
    );
    if (missingSteps.length > 0) {
      const missingList = missingSteps.map((step) => `"${step.id}"`).join(", ");
      errors.push({
        file: relativePath,
        message: `steps missing matching <Step id="…"> components for: ${missingList}`,
      });
    }

    for (const node of stepIds) {
      if (!normalized.steps.some((step) => step.id === node.id)) {
        errors.push({
          file: relativePath,
          message: `unexpected <Step id="${node.id}"> (no matching entry in front matter) on line ${node.line}`,
        });
      }
    }

    const seen = new Set();
    for (const node of stepIds) {
      if (seen.has(node.id)) {
        errors.push({
          file: relativePath,
          message: `duplicate <Step id="${node.id}"> component detected (line ${node.line})`,
        });
      } else {
        seen.add(node.id);
      }
    }

    if (normalized.viz?.spec) {
      const specAbsolutePath = path.resolve(path.dirname(filePath), normalized.viz.spec);
      const relativeSpecPath = path.relative(storiesDir, specAbsolutePath);
      if (relativeSpecPath.startsWith("..") || path.isAbsolute(relativeSpecPath)) {
        errors.push({
          file: relativePath,
          message: `viz.spec "${normalized.viz.spec}" resolves outside of the stories directory`,
        });
      } else {
        try {
          await fs.access(specAbsolutePath);
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            errors.push({
              file: relativePath,
              message: `viz.spec "${normalized.viz.spec}" does not exist`,
            });
          } else {
            throw error;
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
