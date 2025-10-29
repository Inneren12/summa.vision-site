"use client";

import useSWR from "swr";

import type { Filters, FilterValue } from "./url";

export interface DashStoryStep {
  id: string;
  title: string;
}

export interface DashStory {
  slug: string;
  title: string;
  updatedAt: string;
  country?: string;
  sector?: string[];
  steps?: DashStoryStep[];
}

export interface DashDatasetResponse {
  items: DashStory[];
  updatedAt: string;
}

const ensureArray = (value: FilterValue): string[] => {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (value === undefined) {
    return [];
  }
  return [String(value)];
};

export function datasetUrl(slug: string, filters?: Filters): string {
  const params = new URLSearchParams();
  params.set("slug", slug);

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) {
        continue;
      }
      for (const normalized of ensureArray(value)) {
        params.append(key, normalized);
      }
    }
  }

  const search = params.toString();
  return search ? `/api/stories?${search}` : "/api/stories";
}

async function fetchDataset(url: string): Promise<DashDatasetResponse> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load dashboard dataset (${response.status})`);
  }

  return (await response.json()) as DashDatasetResponse;
}

export function useDashDataset(slug: string | undefined, filters?: Filters) {
  const key = slug ? datasetUrl(slug, filters) : null;
  const swr = useSWR<DashDatasetResponse>(key, fetchDataset, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: true,
  });

  return {
    dataset: swr.data,
    isLoading: !swr.error && !swr.data,
    error: swr.error,
    mutate: swr.mutate,
  } as const;
}
