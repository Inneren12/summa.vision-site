export type FilterPrimitive = string;
export type FilterArray = FilterPrimitive[];
export type FilterValue = FilterPrimitive | FilterArray | undefined;

export type Filters = Record<string, FilterValue>;
export type NormalizedFilters = Record<string, FilterPrimitive | FilterPrimitive[]>;

export interface DashQuery {
  filters?: Filters;
  preset?: string;
}

export interface DecodedDashQuery {
  filters: Filters;
  preset?: string;
}

const FILTER_PREFIX = "f";

const toParamKey = (key: string): string => `${FILTER_PREFIX}[${key}]`;

const normalizePrimitive = (value: FilterPrimitive): string => String(value);

const ensureArray = (value: FilterValue): FilterArray =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

export const normalizeFilters = (filters?: Filters): NormalizedFilters => {
  if (!filters) {
    return {};
  }

  const entries = Object.keys(filters)
    .sort()
    .reduce<NormalizedFilters>((acc, key) => {
      const value = filters[key];

      if (value === undefined) {
        return acc;
      }

      acc[key] = Array.isArray(value) ? [...value] : value;
      return acc;
    }, {} as NormalizedFilters);

  return entries;
};

/**
 * Encodes dashboard filters into a deterministic query string.
 */
export function encodeQuery({ filters, preset }: DashQuery): string {
  const params = new URLSearchParams();

  if (preset) {
    params.set("preset", preset);
  }

  const normalized = normalizeFilters(filters);

  Object.keys(normalized).forEach((key) => {
    const paramKey = toParamKey(key);
    const values = ensureArray(normalized[key]);

    if (!values.length) {
      return;
    }

    values.map(normalizePrimitive).forEach((value, index) => {
      if (index === 0) {
        params.set(paramKey, value);
        return;
      }

      params.append(paramKey, value);
    });
  });

  return params.toString();
}

const FILTER_REGEX = /^f\[(.+)\]$/;

export const isFilterParamKey = (key: string): boolean => FILTER_REGEX.test(key);

export function decodeQuery(search: string): DecodedDashQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const filters: Filters = {};

  params.forEach((value, key) => {
    const match = key.match(FILTER_REGEX);

    if (!match) {
      return;
    }

    const filterKey = match[1];
    const existing = filters[filterKey];

    if (existing === undefined) {
      filters[filterKey] = value;
      return;
    }

    const nextValues = ensureArray(existing);
    nextValues.push(value);
    filters[filterKey] = nextValues;
  });

  const normalizedFilters: Filters = {};
  Object.keys(filters)
    .sort()
    .forEach((key) => {
      const values = ensureArray(filters[key]);
      if (values.length === 0) {
        return;
      }
      if (values.length === 1) {
        normalizedFilters[key] = values[0];
        return;
      }
      normalizedFilters[key] = values;
    });

  const preset = params.get("preset") ?? undefined;

  return {
    filters: normalizedFilters,
    preset,
  };
}

export const isFilterArray = (value: FilterValue): value is FilterArray => Array.isArray(value);

export const isFilterPrimitive = (value: FilterValue): value is FilterPrimitive =>
  typeof value === "string";
