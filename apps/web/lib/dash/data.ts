"use client";

import useSWR, { type SWRResponse } from "swr";

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

const datasetFetcher = async (url: string): Promise<DashDatasetResponse> => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache, stale-while-revalidate=60",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load dashboard dataset (${response.status})`);
  }

  const payload = (await response.json()) as Partial<DashDatasetResponse>;

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid dashboard dataset response");
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : "";

  return {
    items,
    updatedAt,
  } satisfies DashDatasetResponse;
};

export interface UseDashDatasetResult {
  dataset?: DashDatasetResponse;
  isLoading: boolean;
  error?: Error;
  empty: boolean;
  mutate: SWRResponse<DashDatasetResponse, Error>["mutate"];
}

export function useDashDataset(slug: string | undefined, filters?: Filters): UseDashDatasetResult {
  const key = slug ? datasetUrl(slug, filters) : null;
  const swr = useSWR<DashDatasetResponse, Error>(key, datasetFetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: true,
  });

  const isLoading = Boolean(slug) && !swr.error && !swr.data;
  const items = swr.data?.items;
  const empty = Array.isArray(items) && items.length === 0;

  return {
    dataset: swr.data,
    isLoading,
    error: swr.error,
    empty,
    mutate: swr.mutate,
  };
}
