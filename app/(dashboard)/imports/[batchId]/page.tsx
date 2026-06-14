import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { ImportReviewTable } from "@/components/imports/import-review-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getImportById } from "@/lib/db/repository";
import { formatJstDateTime } from "@/lib/dates/jst";

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const batch = await getImportById((await params).batchId);
  if (!batch) notFound();
  const unresolved = batch.rows.filter((row) => row.review_required).length;
  return (
    <>
      <Link
        href="/imports"
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#6e746f]"
      >
        <ArrowLeft className="h-4 w-4" />
        取込一覧へ
      </Link>
      <PageHeader
        eyebrow="Import Review"
        title={batch.file_name}
        description={`${batch.source_sheet ?? "-"} / ${batch.period_from ?? "-"} 〜 ${batch.period_to ?? "-"} / ${formatJstDateTime(batch.created_at)}`}
        actions={
          batch.status !== "confirmed" ? (
            <ActionButton
              endpoint={`/api/imports/${batch.id}/confirm`}
              label="確定取込"
              pendingLabel="取込中"
            />
          ) : null
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "総行数", value: batch.total_rows, icon: FileSpreadsheet },
          { label: "取込候補", value: batch.accepted_rows, icon: CheckCircle2 },
          { label: "警告", value: batch.warning_rows, icon: TriangleAlert },
          { label: "未解決", value: unresolved, icon: TriangleAlert },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs text-[#777d78]">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold">{item.value}</p>
                </div>
                <Icon className="h-6 w-6 text-[#d9654f]" />
              </CardContent>
            </Card>
          );
        })}
      </section>
      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-serif text-lg font-semibold">行レビュー</h2>
            <p className="mt-1 text-xs text-[#777d78]">
              確定値、正規化値、推定値を確認
            </p>
          </div>
          <StatusBadge status={batch.status} />
        </CardHeader>
        {batch.rows.length > 0 ? (
          <ImportReviewTable batch={batch} />
        ) : (
          <CardContent className="py-12 text-center text-sm text-[#777d78]">
            この確定済みデモバッチでは、レビューデータを省略しています。
          </CardContent>
        )}
      </Card>
    </>
  );
}
