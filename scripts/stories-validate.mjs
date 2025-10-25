#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { compile } from "@mdx-js/mdx";
import { VFile } from "vfile";
import matter from "gray-matter";
import { visit } from "unist-util-visit";
import { z } from "zod";

const DEFAULT_STORIES_DIRECTORY = path.join(process.cwd(), "content", "stories");

const StepSchema = z.object({
  id: z.string().min(1, "steps[].id must be a non-empty string"),
  title: z.string().min(1, "steps[].title must be a non-empty string"),
  hash: z.string().min(1).optional(),
});

const CoverSchema = z.object({
  src: z.string().min(1, "cover.src is required"),
  alt: z.string().min(1, "cover.alt is required"),
});

const StoryFrontmatterSchema = z.object({
  title: z.string().min(1, "title is required"),
  slug: z.string().min(1, "slug is required"),
  description: z.string().min(1, "description is required"),
  cover: CoverSchema,
  steps: z.array(StepSchema).min(1, "at least one step is required"),
});

const errors = [];

function formatError(filePath, message) {
  errors.push(`${filePath}: ${message}`);
}

function resolveStepHash(id, hash) {
  return hash && hash.trim().length > 0 ? hash.trim() : `step-${id}`;
}

function getAttributeValue(node, attributeName) {
  const attribute = node.attributes?.find(
    (attr) => attr.type === "mdxJsxAttribute" && attr.name === attributeName,
  );
  if (!attribute) {
    return undefined;
  }
  if (attribute.value == null) {
    return "";
  }
  if (typeof attribute.value === "string") {
    return attribute.value;
  }
  if (attribute.value.type === "mdxJsxAttributeValueExpression") {
    return undefined;
  }
  return undefined;
}

async function validateStoryFile(filePath, seenSlugs) {
  const raw = await fs.readFile(filePath, "utf8");
  const { content, data } = matter(raw);
  let frontmatter;
  try {
    frontmatter = StoryFrontmatterSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach((issue) => {
        formatError(filePath, `front matter error: ${issue.message}`);
      });
      return;
    }
    formatError(filePath, `unexpected front matter error: ${error.message}`);
    return;
  }

  const slugOwner = seenSlugs.get(frontmatter.slug);
  if (slugOwner && slugOwner !== filePath) {
    formatError(filePath, `slug "${frontmatter.slug}" already used in ${slugOwner}`);
  } else {
    seenSlugs.set(frontmatter.slug, filePath);
  }

  const stepIdSet = new Set();
  const stepHashSet = new Set();

  for (const step of frontmatter.steps) {
    if (stepIdSet.has(step.id)) {
      formatError(filePath, `duplicate step id "${step.id}" in front matter`);
    } else {
      stepIdSet.add(step.id);
    }
    const resolvedHash = resolveStepHash(step.id, step.hash);
    if (stepHashSet.has(resolvedHash)) {
      formatError(filePath, `duplicate step hash "${resolvedHash}" in front matter`);
    } else {
      stepHashSet.add(resolvedHash);
    }
  }

  const file = new VFile({ value: content, path: filePath });
  await compile(file, {
    outputFormat: "function-body",
    remarkPlugins: [
      () => (tree, compiledFile) => {
        compiledFile.data.mdxast = tree;
      },
    ],
  });
  const tree = file.data?.mdxast;
  if (!tree) {
    return;
  }

  const stepUsage = new Map();
  const stepElements = [];

  visit(tree, (node) => {
    if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
      if (node.name === "Step") {
        stepElements.push(node);
      }
      if (node.name === "img" || node.name === "Image") {
        const alt = getAttributeValue(node, "alt");
        if (!alt || alt.trim().length === 0) {
          formatError(filePath, `<${node.name}> element is missing an alt attribute`);
        }
      }
      if (node.name === "a") {
        const href = getAttributeValue(node, "href");
        if (!href || href.trim().length === 0) {
          formatError(filePath, "<a> element is missing an href attribute");
        }
      }
    }
    if (node.type === "image") {
      if (!node.alt || node.alt.trim().length === 0) {
        formatError(filePath, `Image referencing "${node.url ?? ""}" is missing alt text`);
      }
    }
    if (node.type === "link") {
      const url = node.url ?? "";
      if (url.trim().length === 0) {
        formatError(filePath, "Markdown link is missing a destination URL");
      }
    }
  });

  if (stepElements.length !== frontmatter.steps.length) {
    formatError(
      filePath,
      `front matter declares ${frontmatter.steps.length} steps but found ${stepElements.length} <Step> elements`,
    );
  }

  const frontmatterStepsById = new Map(frontmatter.steps.map((step) => [step.id, step]));

  for (const node of stepElements) {
    const id = getAttributeValue(node, "id");
    if (!id) {
      formatError(filePath, "<Step> is missing the required id attribute");
      continue;
    }
    const title = getAttributeValue(node, "title");
    if (!title) {
      formatError(filePath, `<Step id="${id}"> is missing the required title attribute`);
    }
    const hash = getAttributeValue(node, "hash");
    const frontmatterStep = frontmatterStepsById.get(id);
    if (!frontmatterStep) {
      formatError(filePath, `<Step id="${id}"> has no matching entry in front matter steps[]`);
      continue;
    }
    stepUsage.set(id, (stepUsage.get(id) ?? 0) + 1);
    const resolvedFrontmatterHash = resolveStepHash(frontmatterStep.id, frontmatterStep.hash);
    if (hash && hash !== resolvedFrontmatterHash) {
      formatError(
        filePath,
        `<Step id="${id}"> hash attribute "${hash}" does not match front matter hash "${resolvedFrontmatterHash}"`,
      );
    }
    if (title && title.trim() !== frontmatterStep.title.trim()) {
      formatError(
        filePath,
        `<Step id="${id}"> title "${title}" does not match front matter title "${frontmatterStep.title}"`,
      );
    }
  }

  for (const step of frontmatter.steps) {
    if (!stepUsage.has(step.id)) {
      formatError(
        filePath,
        `front matter step "${step.id}" is not rendered with a <Step> component`,
      );
    } else if (stepUsage.get(step.id) > 1) {
      formatError(filePath, `<Step id="${step.id}"> appears multiple times`);
    }
  }
}

async function main() {
  const seenSlugs = new Map();
  const targetDirectory = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_STORIES_DIRECTORY;
  let files;
  try {
    files = await fs.readdir(targetDirectory);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn(`No stories directory found at ${targetDirectory}`);
      process.exit(0);
    }
    throw error;
  }

  const mdxFiles = files.filter((file) => file.toLowerCase().endsWith(".mdx"));
  if (mdxFiles.length === 0) {
    console.warn(`No story files found in ${targetDirectory}`);
    process.exit(0);
  }

  await Promise.all(
    mdxFiles.map((file) => validateStoryFile(path.join(targetDirectory, file), seenSlugs)),
  );

  if (errors.length > 0) {
    console.error(
      "Story validation failed:\n" + errors.map((message) => ` - ${message}`).join("\n"),
    );
    process.exit(1);
  }

  console.log(
    `Validated ${mdxFiles.length} stor${mdxFiles.length === 1 ? "y" : "ies"} successfully.`,
  );
}

main().catch((error) => {
  console.error("Unexpected error while validating stories:", error);
  process.exit(1);
});
