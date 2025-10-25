import type { Metadata } from "next";

import Step from "@/components/scrolly/Step";
import StickyPanel from "@/components/scrolly/StickyPanel";
import Story from "@/components/scrolly/Story";
import StoryShareButton from "@/components/scrolly/StoryShareButton";

import "../scrolly.css";

type StoryStep = {
  id: string;
  title: string;
  body: string;
};

const demoSteps: StoryStep[] = [
  {
    id: "introduction",
    title: "Введение",
    body: "Скроллителлинг объединяет визуализацию и повествование, позволяя раскрыть сложные идеи шаг за шагом.",
  },
  {
    id: "insight",
    title: "Наблюдение",
    body: "Фокус на одном утверждении за раз помогает читателю удерживать внимание и воспринимать информацию в нужном темпе.",
  },
  {
    id: "interaction",
    title: "Вовлечение",
    body: "Стики-панель поддерживает контекст, тогда как поток шагов раскрывает детали истории по мере прокрутки.",
  },
  {
    id: "summary",
    title: "Итог",
    body: "Каркас S6 обеспечивает единые токены, адаптивность и доступность, сокращая время на запуск новых историй.",
  },
];

export const metadata: Metadata = {
  title: "S6 Story — демо",
  description: "Базовый каркас для историй с двухпанельным скроллителлингом.",
};

export default function StoryPage({ params }: { params: { slug: string } }) {
  const storyId = params?.slug ?? "story-demo";
  return (
    <Story stickyTop="calc(var(--space-8) * 3)" storyId={storyId}>
      <StickyPanel>
        <figure aria-labelledby="story-figure-title story-figure-caption">
          <div aria-hidden="true" className="scrolly-demo-graphic" />
          <h2 className="scrolly-step__title" id="story-figure-title">
            Визуализация истории
          </h2>
          <figcaption className="scrolly-step__body" id="story-figure-caption">
            Закреплённая панель отображает интерактив или иллюстрацию и остаётся в пределах
            вьюпорта.
          </figcaption>
          <StoryShareButton />
        </figure>
      </StickyPanel>
      {demoSteps.map((step) => (
        <Step key={step.id} id={step.id} title={step.title}>
          <p>{step.body}</p>
        </Step>
      ))}
    </Story>
  );
}
