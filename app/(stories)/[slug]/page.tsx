import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import Progress from "@/components/scrolly/Progress";
import StickyPanel from "@/components/scrolly/StickyPanel";
import Story from "@/components/scrolly/Story";
import StoryShareButton from "@/components/scrolly/StoryShareButton";
import { getStoryBySlug, getStoryIndex } from "@/lib/stories/story-loader";

import "../scrolly.css";

type StoryPageParams = {
  slug: string;
};

export async function generateStaticParams() {
  const stories = await getStoryIndex();
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: { params: StoryPageParams }): Promise<Metadata> {
  const stories = await getStoryIndex();
  const story = stories.find((entry) => entry.slug === params.slug);

  if (!story) {
    return {
      title: "История не найдена",
    };
  }

  return {
    title: story.title,
    description: story.description,
  } satisfies Metadata;
}

export default async function StoryPage({ params }: { params: StoryPageParams }) {
  const story = await getStoryBySlug(params.slug);

  if (!story) {
    notFound();
  }

  const { frontMatter, content, visualizationPrefetchPlan } = story;

  return (
    <Story
      stickyTop="calc(var(--space-8) * 3)"
      storyId={frontMatter.slug}
      visualizationLib={frontMatter.viz?.lib}
      visualizationPrefetchPlan={visualizationPrefetchPlan ?? undefined}
    >
      <StickyPanel>
        <figure aria-labelledby="story-figure-title story-figure-caption">
          <div className="story-cover">
            <Image
              alt={frontMatter.cover.alt}
              className="story-cover__image"
              fill
              priority
              sizes="(min-width: 1024px) 420px, 100vw"
              src={frontMatter.cover.src}
            />
          </div>
          <h2 className="scrolly-step__title" id="story-figure-title">
            {frontMatter.title}
          </h2>
          <figcaption className="scrolly-step__body" id="story-figure-caption">
            {frontMatter.description}
          </figcaption>
          <nav aria-label="Шаги истории" className="story-step-nav">
            <ol className="story-step-nav__list">
              {frontMatter.steps.map((step, index) => (
                <li key={step.id} className="story-step-nav__item">
                  <a className="story-step-nav__link" href={`#${step.hash}`}>
                    <span className="story-step-nav__index">{index + 1}</span>
                    <span className="story-step-nav__title">{step.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <Progress />
          <StoryShareButton />
        </figure>
      </StickyPanel>
      {content}
    </Story>
  );
}
