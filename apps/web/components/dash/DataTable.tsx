"use client";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useMemo } from "react";

type Row = Record<string, unknown>;

const columnHelper = createColumnHelper<Row>();

export default function DataTable({ rows = [] as Row[] }: { rows?: Row[] }) {
  const columns = useMemo(
    () =>
      Object.keys(rows[0] ?? { value: "—" }).map((k) => columnHelper.accessor(k, { header: k })),
    [rows],
  );
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="border-b px-2 py-2 text-left">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="odd:bg-gray-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="border-b px-2 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
