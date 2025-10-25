"use client";

import { useCallback, type ReactNode } from "react";

import { useStoryContext } from "./Story";

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type StoryShareButtonProps = {
  className?: string;
  children?: ReactNode;
};

export default function StoryShareButton({ className, children }: StoryShareButtonProps) {
  const { trackShareClick } = useStoryContext();

  const handleClick = useCallback(async () => {
    trackShareClick();
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore share errors, analytics event already emitted
    }
  }, [trackShareClick]);

  return (
    <button
      type="button"
      className={classNames("scrolly-share-button", className)}
      onClick={handleClick}
    >
      {children ?? "Поделиться"}
    </button>
  );
}
