"use client";

import { useMemo, useState } from "react";

type Row = Record<string, unknown>;

type SortDirection = "asc" | "desc";

type SortState = {
  key: string;
  direction: SortDirection;
};

const PLACEHOLDER_COLUMN = "value";
const PLACEHOLDER_VALUE = "—";

function getComparableValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return String(value).toLocaleLowerCase();
}

function toggleDirection(direction: SortDirection | undefined): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}

export default function DataTable({ rows = [] as Row[] }: { rows?: Row[] }) {
  const columnKeys = useMemo(() => {
    if (!rows.length) {
      return [PLACEHOLDER_COLUMN];
    }

    const keys = new Set<string>();

    for (const row of rows) {
      Object.keys(row).forEach((key) => keys.add(key));
    }

    return Array.from(keys);
  }, [rows]);

  const [sortState, setSortState] = useState<SortState | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortState) {
      return rows;
    }

    const { key, direction } = sortState;
    const directionMultiplier = direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const left = getComparableValue(a[key]);
      const right = getComparableValue(b[key]);

      if (left === right) {
        return 0;
      }

      if (left > right) {
        return directionMultiplier;
      }

      return -directionMultiplier;
    });
  }, [rows, sortState]);

  const onHeaderClick = (key: string) => () => {
    setSortState((previous) => {
      if (!previous || previous.key !== key) {
        return { key, direction: "asc" } as SortState;
      }

      return {
        key,
        direction: toggleDirection(previous.direction),
      } as SortState;
    });
  };

  return (
    <div className="rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columnKeys.map((key) => {
              const isActive = sortState?.key === key;
              const indicator = isActive ? (sortState?.direction === "asc" ? "▲" : "▼") : null;

              return (
                <th
                  key={key}
                  className="px-2 py-2 text-left border-b select-none cursor-pointer"
                  onClick={onHeaderClick(key)}
                  title="Click to sort"
                >
                  <span className="inline-flex items-center gap-1">
                    {key}
                    {indicator ? <span>{indicator}</span> : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length ? (
            sortedRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-gray-50">
                {columnKeys.map((key) => {
                  const value = row[key] ?? PLACEHOLDER_VALUE;

                  return (
                    <td key={key} className="px-2 py-2 border-b">
                      {String(value)}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-2 py-2 border-b" colSpan={columnKeys.length}>
                {PLACEHOLDER_VALUE}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
