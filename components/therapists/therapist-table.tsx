"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import type { TherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, percentage } from "@/lib/utils";

const column = createColumnHelper<TherapistMetrics>();

export function TherapistTable({ data }: { data: TherapistMetrics[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sales", desc: true },
  ]);
  const [filter, setFilter] = useState("");
  // TanStack Table intentionally exposes non-memoizable helper functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: [
      column.accessor("therapist.display_name", {
        id: "name",
        header: "セラピスト",
        cell: (info) => (
          <Link
            href={`/therapists/${info.row.original.therapist.id}`}
            className="font-bold text-[#17202a] hover:text-[#b64f3b]"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      column.accessor("storeName", { header: "主店舗" }),
      column.accessor("shiftDays", { header: "出勤日" }),
      column.accessor("postAppearances", { header: "掲載" }),
      column.accessor("therapist.publication_consent", {
        id: "publicationConsent",
        header: "掲載同意",
        cell: (info) => (
          <Badge tone={info.getValue() ? "success" : "warning"}>
            {info.getValue() ? "確認済み" : "要確認"}
          </Badge>
        ),
      }),
      column.accessor("sales", {
        header: "売上",
        cell: (info) => (
          <span className="font-semibold tabular">
            {formatCurrency(info.getValue())}
          </span>
        ),
      }),
      column.accessor("bookings", { header: "本数" }),
      column.accessor("averageTicket", {
        header: "客単価",
        cell: (info) => formatCurrency(info.getValue()),
      }),
      column.accessor("hourlySales", {
        header: "時間売上",
        cell: (info) => formatCurrency(info.getValue()),
      }),
      column.accessor("nominationRatio", {
        header: "指名率",
        cell: (info) => percentage(info.getValue()),
      }),
      column.accessor("difference", {
        header: "実験差分",
        cell: (info) => info.getValue() === null ? (
          <span className="text-xs text-[#777d78]">評価対象外</span>
        ) : (
          <span
            className={
              info.getValue()! >= 0 ? "font-semibold text-[#2f7d6d]" : "text-[#b34839]"
            }
          >
            {info.getValue()! >= 0 ? "+" : ""}
            {formatCurrency(info.getValue())}
          </span>
        ),
      }),
      column.accessor("quality", {
        header: "判定",
        cell: (info) => (
          <Badge
            tone={
              info.getValue() === "比較対象"
                ? "success"
                : info.getValue() === "参考値"
                  ? "warning"
                  : "neutral"
            }
          >
            {info.getValue()}
          </Badge>
        ),
      }),
    ],
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  return (
    <div>
      <div className="border-b bg-[#faf8f4] p-4">
        <label className="relative block max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#858b86]" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="名前・店舗を検索"
            className="h-9 w-full rounded-lg border bg-white pl-9 pr-3 text-sm"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="border-b bg-white text-[11px] uppercase tracking-wider text-[#777d78]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-bold">
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() ? (
                        <ArrowUpDown className="h-3 w-3 opacity-45" />
                      ) : null}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="bg-[#fffdf9] hover:bg-[#faf8f4]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
