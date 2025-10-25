import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorySteps } from "../StorySteps";

import { MdxStoryStep } from "@/components/story/MdxStep";
import { getStoryBySlug, listStorySlugs } from "@/lib/stories";

interface StoryPageProps {
  readonly params: { slug: string };
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await listStorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { slug } = params;
  const story = await getStoryBySlug(slug);
  if (!story) {
    return {};
  }
  return {
    title: story.frontmatter.title,
    description: story.frontmatter.description,
    openGraph: {
      title: story.frontmatter.title,
      description: story.frontmatter.description,
    },
  } satisfies Metadata;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = params;
  const story = await getStoryBySlug(slug);
  if (!story) {
    notFound();
  }

  const { frontmatter, Content } = story;

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="bg-bg/80 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          Scrollytelling preview
        </p>
        <h1 className="mt-4 text-4xl font-bold">{frontmatter.title}</h1>
        <p className="mt-4 text-lg text-muted">{frontmatter.description}</p>
      </header>
      <StorySteps steps={frontmatter.steps}>
        <Content components={{ Step: MdxStoryStep }} />
      </StorySteps>
    </main>
  );
}
