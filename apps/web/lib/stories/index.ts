import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { compile } from "@mdx-js/mdx";
import { run } from "@mdx-js/mdx";
import matter from "gray-matter";
import type { MDXContent } from "mdx/types";
import * as runtime from "react/jsx-runtime";
import { z } from "zod";

const STORIES_DIRECTORY = path.join(process.cwd(), "content", "stories");

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

export type StoryFrontmatter = z.infer<typeof StoryFrontmatterSchema>;
export type StoryStep = z.infer<typeof StepSchema>;

type StoryFile = {
  readonly frontmatter: StoryFrontmatter;
  readonly content: string;
  readonly filePath: string;
};

type StoryModule = {
  readonly frontmatter: StoryFrontmatter;
  readonly Content: MDXContent;
};

let storiesCache: Promise<StoryFile[]> | null = null;

async function readStoryFiles(): Promise<StoryFile[]> {
  const entries = await fs.readdir(STORIES_DIRECTORY, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mdx"))
    .map((entry) => path.join(STORIES_DIRECTORY, entry.name));

  const storyFiles = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, "utf8");
      const { content, data } = matter(raw);
      const frontmatter = StoryFrontmatterSchema.parse(data);
      return { frontmatter, content, filePath } satisfies StoryFile;
    }),
  );

  return storyFiles;
}

async function getStories(): Promise<StoryFile[]> {
  if (!storiesCache) {
    storiesCache = readStoryFiles();
  }
  return storiesCache;
}

export async function listStories(): Promise<StoryFrontmatter[]> {
  const stories = await getStories();
  return stories.map((story) => story.frontmatter);
}

export async function getStoryBySlug(slug: string): Promise<StoryModule | null> {
  const stories = await getStories();
  const story = stories.find((entry) => entry.frontmatter.slug === slug);
  if (!story) {
    return null;
  }
  const compiled = await compile(
    { value: story.content, path: story.filePath },
    {
      outputFormat: "function-body",
      development: process.env.NODE_ENV !== "production",
    },
  );
  const { default: Content } = await run(compiled, {
    ...runtime,
    useMDXComponents: () => ({}),
  });
  return { frontmatter: story.frontmatter, Content } satisfies StoryModule;
}

export async function listStorySlugs(): Promise<string[]> {
  const stories = await getStories();
  return stories.map((story) => story.frontmatter.slug);
}
