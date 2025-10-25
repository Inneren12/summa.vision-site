import type { ReactNode } from "react";

export interface MdxStoryStepProps {
  readonly id: string;
  readonly title: string;
  readonly hash?: string;
  readonly children?: ReactNode;
}

function resolveStepHash(id: string, hash?: string): string {
  return hash && hash.trim().length > 0 ? hash : `step-${id}`;
}

export function MdxStoryStep({ id, title, hash, children }: MdxStoryStepProps) {
  const anchor = resolveStepHash(id, hash);

  return (
    <article
      id={anchor}
      data-step-id={id}
      className="story-step-anchor scroll-mt-28 rounded-3xl border border-muted/20 bg-bg/80 p-8 shadow-sm transition"
    >
      <h3 className="text-3xl font-semibold text-fg">{title}</h3>
      <div className="mt-4 space-y-4 text-lg leading-7 text-muted">{children}</div>
    </article>
  );
}

export function getStepHash(id: string, hash?: string): string {
  return resolveStepHash(id, hash);
}
