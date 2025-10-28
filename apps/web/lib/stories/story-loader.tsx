import fs from "node:fs/promises";
import path from "node:path";

import type { StoryFrontMatter, StoryVisualizationConfig } from "@root/lib/content/stories/schema";
import { normalizeStoryFrontMatter } from "@root/lib/content/stories/schema.mjs";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps, ComponentType, ReactElement } from "react";

import Step from "../../../../components/scrolly/Step";

import type { StoryVisualizationPrefetchPlan } from "./types";

const STORIES_DIR = path.join(process.cwd(), "content", "stories");

export type StoryModule = {
  slug: string;
  frontMatter: StoryFrontMatter;
  content: ReactElement;
  visualizationPrefetchPlan: StoryVisualizationPrefetchPlan | null;
};

type StepComponentProps = ComponentProps<typeof Step>;

function createMdxComponents(frontMatter: StoryFrontMatter) {
  function StoryMdxStep(props: StepComponentProps) {
    const stepMeta = frontMatter.steps.find((step) => step.id === props.id);
    if (!stepMeta) {
      throw new Error(`Missing step metadata for <Step id="${props.id}">`);
    }
    return <Step {...props} anchorId={stepMeta.hash} />;
  }

  return {
    Step: StoryMdxStep,
  } satisfies Record<string, ComponentType<StepComponentProps>>;
}

async function compileStoryContent(source: string, frontMatter: StoryFrontMatter) {
  const { content } = await compileMDX<{ frontMatter: StoryFrontMatter }>({
    source,
    options: {
      parseFrontmatter: false,
    },
    components: createMdxComponents(frontMatter),
  });
  return content as ReactElement;
}

function createVisualizationPrefetchPlan(
  frontMatter: StoryFrontMatter,
  filePath: string,
): StoryVisualizationPrefetchPlan | null {
  if (!frontMatter.viz) {
    return null;
  }

  const { needs, spec } = frontMatter.viz;
  const planNeeds = needs ?? [];

  let specPath: string | undefined;
  if (spec) {
    const resolved = path.resolve(path.dirname(filePath), spec);
    const relative = path.relative(STORIES_DIR, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(
        `viz.spec resolves outside of stories directory for story "${frontMatter.slug}"`,
      );
    }
    const normalized = relative.split(path.sep).filter(Boolean).join("/");
    specPath = normalized;
  }

  if (!specPath && planNeeds.length === 0) {
    return null;
  }

  return {
    needs: planNeeds,
    ...(specPath ? { specPath } : {}),
  };
}

export async function getStoryBySlug(slug: string): Promise<StoryModule | null> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(STORIES_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".mdx")) {
      continue;
    }
    const filePath = path.join(STORIES_DIR, entry);
    const fileContents = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(fileContents);
    const frontMatter = normalizeStoryFrontMatter(data, path.relative(process.cwd(), filePath));
    if (frontMatter.slug === slug) {
      const plan = createVisualizationPrefetchPlan(frontMatter as StoryFrontMatter, filePath);
      return {
        slug,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        frontMatter: frontMatter as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: await compileStoryContent(content, frontMatter as any),
        visualizationPrefetchPlan: plan,
      } satisfies StoryModule;
    }
  }

  return null;
}

export async function getStoryIndex(): Promise<StoryFrontMatter[]> {
  const entries = await fs.readdir(STORIES_DIR);
  const stories: StoryFrontMatter[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".mdx")) continue;
    const filePath = path.join(STORIES_DIR, entry);
    const fileContents = await fs.readFile(filePath, "utf8");
    const { data } = matter(fileContents);

    const fm0 = normalizeStoryFrontMatter(data, path.relative(process.cwd(), filePath));

    const viz =
      fm0.viz === undefined
        ? undefined
        : ({ ...fm0.viz, needs: fm0.viz.needs ?? [] } satisfies StoryVisualizationConfig);

    const fm: StoryFrontMatter = {
      ...fm0,
      viz,
      // гарантируем строковый hash
      steps: fm0.steps.map((s) => ({ ...s, hash: s.hash ?? s.id })),
    };

    stories.push(fm);
  }
  return stories.sort((a, b) => a.title.localeCompare(b.title));
}
