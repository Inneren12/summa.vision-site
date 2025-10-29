"use client";

import { del, get, set } from "idb-keyval";
import { useEffect } from "react";
import useSWR from "swr";

import {
  storyFrontMatterSchema,
  storyIndexCacheSchema,
  storyIndexResponseSchema,
  type StoryFrontMatter,
  type StoryIndexCache,
} from "./schemas";

const STORY_INDEX_SWR_KEY = "/api/stories";
const STORY_INDEX_CACHE_KEY = "summa:stories:index:v1";

async function readCache(): Promise<StoryFrontMatter[] | null> {
  try {
    const raw = await get<StoryIndexCache | undefined>(STORY_INDEX_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = storyIndexCacheSchema.safeParse(raw);
    if (!parsed.success) {
      await del(STORY_INDEX_CACHE_KEY);
      return null;
    }
    return parsed.data.stories;
  } catch (error) {
    console.error("Failed to read story index cache", error);
    return null;
  }
}

async function writeCache(stories: StoryFrontMatter[]): Promise<void> {
  try {
    const normalized = stories.map((story) => storyFrontMatterSchema.parse(story));
    await set(STORY_INDEX_CACHE_KEY, { stories: normalized, cachedAt: Date.now() });
  } catch (error) {
    console.error("Failed to persist story index cache", error);
  }
}

async function fetchStoryIndex(): Promise<StoryFrontMatter[]> {
  try {
    const response = await fetch(STORY_INDEX_SWR_KEY, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load story index (${response.status})`);
    }

    const payload = await response.json();
    const parsed = storyIndexResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw parsed.error;
    }

    await writeCache(parsed.data.stories);
    return parsed.data.stories;
  } catch (error) {
    const cached = await readCache();
    if (cached) {
      return cached;
    }
    throw error;
  }
}

export function useStoryIndex() {
  const swr = useSWR<StoryFrontMatter[]>(STORY_INDEX_SWR_KEY, fetchStoryIndex, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: true,
  });

  useEffect(() => {
    let cancelled = false;
    readCache().then((cached) => {
      if (cancelled || !cached) {
        return;
      }
      swr.mutate(cached, { revalidate: false });
    });
    return () => {
      cancelled = true;
    };
  }, [swr.mutate]);

  return {
    stories: swr.data ?? [],
    isLoading: !swr.error && !swr.data,
    error: swr.error,
    mutate: swr.mutate,
  } as const;
}

export async function getCachedStoryIndex(): Promise<StoryFrontMatter[] | null> {
  return readCache();
}
