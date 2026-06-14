"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ImportBatch } from "@/lib/types";

export function ImportReviewTable({ batch }: { batch: ImportBatch }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  async function accept(rowId: string) {
    setPendingId(rowId);
    await fetch(`/api/imports/${batch.id}/rows/${rowId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    setPendingId(null);
    router.refresh();
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b bg-[#faf8f4] text-xs text-[#777d78]">
          <tr>
            <th className="px-4 py-3">行</th>
            <th className="px-4 py-3">分類</th>
            <th className="px-4 py-3">日付</th>
            <th className="px-4 py-3">セラピスト</th>
            <th className="px-4 py-3 text-right">売上</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">確認事項</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {batch.rows.map((row) => (
            <tr key={row.id} className={row.review_required ? "bg-[#fffaf0]" : ""}>
              <td className="px-4 py-3 tabular">{row.row_number}</td>
              <td className="px-4 py-3">
                <Badge tone={row.classification === "unknown" ? "warning" : "neutral"}>
                  {row.classification}
                </Badge>
              </td>
              <td className="px-4 py-3 tabular">
                {row.normalized.sales_date ?? "-"}
              </td>
              <td className="px-4 py-3">
                {row.normalized.therapist_raw ?? "-"}
              </td>
              <td className="px-4 py-3 text-right tabular">
                {Number(row.normalized.sales_amount ?? 0).toLocaleString("ja-JP")}円
              </td>
              <td className="px-4 py-3">{row.confidence}</td>
              <td className="max-w-xs px-4 py-3 text-xs text-[#8a6424]">
                {[...row.errors, ...row.warnings].join(" / ") || "-"}
              </td>
              <td className="px-4 py-3">
                {row.review_required ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => accept(row.id)}
                    disabled={pendingId === row.id}
                  >
                    {pendingId === row.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    確認済み
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
