"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type RangeTuple = [number, number];

export interface DashState {
  country?: string;
  sectors: string[];
  date?: string;
  range: RangeTuple;
}

const RANGE_BOUNDS = { min: 2010, max: 2030 } as const;
const RANGE_DEFAULT: RangeTuple = [2018, 2024];

export const createDefaultDashState = (): DashState => ({
  country: undefined,
  sectors: [],
  date: undefined,
  range: [...RANGE_DEFAULT] as RangeTuple,
});

type DashStateContextValue = {
  state: DashState;
  setState: Dispatch<SetStateAction<DashState>>;
};

const DashStateContext = createContext<DashStateContextValue | null>(null);

const FILTER_PREFIX = "f[";

const paramKey = (name: string) => `f[${name}]`;

function parseRange(value: string | null): RangeTuple | null {
  if (!value) return null;
  const [startRaw, endRaw] = value.split("..");
  const start = Number.parseInt(startRaw ?? "", 10);
  const end = Number.parseInt(endRaw ?? "", 10);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  return [min, max];
}

function parseDashState(params: ReadonlyURLSearchParams): DashState {
  const country = params.get(paramKey("country")) ?? undefined;
  const date = params.get(paramKey("date")) ?? undefined;
  const range = parseRange(params.get(paramKey("range")));
  const sectorValues = params.getAll(paramKey("sector")).flatMap((entry) =>
    entry
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const sectors = Array.from(new Set(sectorValues));

  return {
    country,
    date,
    sectors,
    range: range ?? ([...RANGE_DEFAULT] as RangeTuple),
  };
}

function dashStateEquals(a: DashState, b: DashState) {
  if (a.country !== b.country) return false;
  if (a.date !== b.date) return false;
  if (a.range[0] !== b.range[0] || a.range[1] !== b.range[1]) return false;
  if (a.sectors.length !== b.sectors.length) return false;
  return a.sectors.every((value, idx) => value === b.sectors[idx]);
}

function sanitizeState(state: DashState): DashState {
  const [rawMin, rawMax] = state.range ?? RANGE_DEFAULT;
  const boundedMin = Math.min(Math.max(rawMin, RANGE_BOUNDS.min), RANGE_BOUNDS.max);
  const boundedMax = Math.min(Math.max(rawMax, RANGE_BOUNDS.min), RANGE_BOUNDS.max);
  const min = Math.min(boundedMin, boundedMax);
  const max = Math.max(boundedMin, boundedMax);
  const uniqueSectors = Array.from(new Set(state.sectors.filter(Boolean)));
  return {
    country: state.country || undefined,
    date: state.date || undefined,
    sectors: uniqueSectors,
    range: [min, max] as RangeTuple,
  };
}

function serializeStateToSearch(state: DashState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.country) {
    params.set(paramKey("country"), state.country);
  }
  if (state.date) {
    params.set(paramKey("date"), state.date);
  }
  if (state.sectors.length > 0) {
    state.sectors.forEach((value) => params.append(paramKey("sector"), value));
  }
  if (state.range[0] !== RANGE_DEFAULT[0] || state.range[1] !== RANGE_DEFAULT[1]) {
    params.set(paramKey("range"), `${state.range[0]}..${state.range[1]}`);
  }
  return params;
}

function mergeParams(base: ReadonlyURLSearchParams, patch: URLSearchParams) {
  const next = new URLSearchParams(base.toString());
  Array.from(next.keys())
    .filter((key) => key.startsWith(FILTER_PREFIX))
    .forEach((key) => next.delete(key));
  patch.forEach((value, key) => {
    next.append(key, value);
  });
  return next;
}

export function DashStateProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [state, setStateInternal] = useState<DashState>(() =>
    sanitizeState(parseDashState(searchParams)),
  );

  useEffect(() => {
    const parsed = sanitizeState(parseDashState(searchParams));
    setStateInternal((prev) => (dashStateEquals(prev, parsed) ? prev : parsed));
  }, [searchParams]);

  const setState = useCallback<Dispatch<SetStateAction<DashState>>>(
    (updater) => {
      setStateInternal((prev) => {
        const input =
          typeof updater === "function"
            ? (updater as (value: DashState) => DashState)(prev)
            : updater;
        const nextState = sanitizeState(input);
        const patch = serializeStateToSearch(nextState);
        const merged = mergeParams(searchParams, patch);
        const query = merged.toString();
        if (query !== searchParams.toString()) {
          router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
        }
        return nextState;
      });
    },
    [pathname, router, searchParams],
  );

  const value = useMemo(
    () => ({
      state,
      setState,
    }),
    [setState, state],
  );

  return <DashStateContext.Provider value={value}>{children}</DashStateContext.Provider>;
}

export function useDashState() {
  const ctx = useContext(DashStateContext);
  if (!ctx) {
    throw new Error("useDashState must be used within a DashStateProvider");
  }
  return ctx;
}

export { RANGE_DEFAULT as DASH_RANGE_DEFAULT, RANGE_BOUNDS as DASH_RANGE_LIMITS };
