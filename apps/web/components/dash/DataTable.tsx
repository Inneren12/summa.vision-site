'use client';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

type Row = Record<string, unknown>;

export default function DataTable({ rows = [] as Row[] }: { rows?: Row[] }) {
  const columnHelper = useMemo(() => createColumnHelper<Row>(), []);
  const columns = useMemo(
    () =>
      Object.keys(rows[0] ?? { value: '—' }).map((k) =>
        // простейшие колонки по ключам входных объектов
        columnHelper.accessor(k as unknown as keyof Row, {
          header: k,
        }),
      ),
    [columnHelper, rows],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-2 py-2 text-left border-b select-none cursor-pointer"
                  onClick={h.column.getToggleSortingHandler()}
                  title="Click to sort"
                >
                  <span className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' && <span>▲</span>}
                    {h.column.getIsSorted() === 'desc' && <span>▼</span>}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="odd:bg-gray-50">
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="px-2 py-2 border-b">
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
