"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { z } from "zod";

import { decodeQuery, encodeQuery, isFilterParamKey, normalizeFilters, type Filters } from "./url";
export { isFilterArray, isFilterPrimitive } from "./url";

export const FilterValueSchema = z.union([z.string(), z.array(z.string())]);
export const FiltersSchema = z.record(FilterValueSchema);

export const DashStateSchema = z.object({
  filters: FiltersSchema.optional().default({}),
  preset: z.string().optional(),
});

export type DashState = z.infer<typeof DashStateSchema>;

export type DashStateUpdater = (prev: DashState) => DashState;
export type FiltersUpdater =
  | Filters
  | DashState["filters"]
  | ((prev: DashState["filters"]) => Filters | DashState["filters"]);

const isBrowser = typeof window !== "undefined";

const parseState = (input: unknown): DashState => {
  const normalized =
    input && typeof input === "object"
      ? {
          ...(input as Record<string, unknown>),
          filters: normalizeFilters((input as { filters?: Filters }).filters),
        }
      : input;

  const parsed = DashStateSchema.safeParse(normalized);

  if (parsed.success) {
    return parsed.data;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("useDashState: invalid state received", parsed.error);
  }

  return { filters: {}, preset: undefined };
};

const getInitialState = (initial: DashState | undefined): DashState => {
  if (!isBrowser) {
    return parseState(initial);
  }

  const { filters, preset } = decodeQuery(window.location.search);

  return parseState({
    filters: { ...(initial?.filters ?? {}), ...filters },
    preset: preset ?? initial?.preset,
  });
};

interface UseDashStateReturn {
  state: DashState;
  setState: Dispatch<SetStateAction<DashState>>;
  setFilters: (next: FiltersUpdater) => void;
}

export function useDashState(initial?: DashState): UseDashStateReturn {
  const initialRef = useRef(initial);
  const [state, setState] = useState<DashState>(() => getInitialState(initialRef.current));

  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const handlePopState = () => {
      const nextFromUrl = decodeQuery(window.location.search);
      setState((prev) => {
        const next = parseState({
          filters: { ...(initialRef.current?.filters ?? {}), ...nextFromUrl.filters },
          preset: nextFromUrl.preset ?? initialRef.current?.preset,
        });

        if (JSON.stringify(prev) === JSON.stringify(next)) {
          return prev;
        }

        return next;
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const search = encodeQuery({
      filters: state.filters,
      preset: state.preset,
    });

    const originalSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    const mergedParams = new URLSearchParams(originalSearch);

    Array.from(mergedParams.keys()).forEach((key) => {
      if (isFilterParamKey(key) || key === "preset") {
        mergedParams.delete(key);
      }
    });

    const nextParams = new URLSearchParams(search);
    nextParams.forEach((value, key) => {
      mergedParams.append(key, value);
    });

    const nextSearchRaw = mergedParams.toString();
    const normalizedSearch = nextSearchRaw ? `?${nextSearchRaw}` : "";

    if (window.location.search === normalizedSearch) {
      return;
    }

    const nextUrl = `${window.location.pathname}${normalizedSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [state]);

  const setFilters = useCallback((next: FiltersUpdater) => {
    setState((prev) => {
      const nextFilters =
        typeof next === "function"
          ? (next as (prev: DashState["filters"]) => Filters | DashState["filters"])(prev.filters)
          : next;
      return parseState({
        ...prev,
        filters: nextFilters as Filters,
      });
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      setState,
      setFilters,
    }),
    [setFilters, state],
  );

  return value;
}
