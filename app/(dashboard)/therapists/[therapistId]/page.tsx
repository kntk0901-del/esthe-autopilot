import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleDollarSign, Clock3, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getAppData } from "@/lib/db/repository";
import { formatCurrency, percentage } from "@/lib/utils";
import { TherapistSettingsForm } from "@/components/therapists/therapist-settings-form";

export default async function TherapistDetailPage({
  params,
}: {
  params: Promise<{ therapistId: string }>;
}) {
  const data = await getAppData();
  const therapistId = (await params).therapistId;
  const metric = calculateTherapistMetrics(data).find(
    (item) => item.therapist.id === therapistId,
  );
  if (!metric) notFound();
  const recentSales = data.salesRecords
    .filter((record) => record.therapist_id === metric.therapist.id)
    .slice(-12)
    .reverse();
  return (
    <>
      <Link
        href="/therapists"
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#6e746f]"
      >
        <ArrowLeft className="h-4 w-4" />
        一覧へ
      </Link>
      <PageHeader
        eyebrow={metric.storeName}
        title={`${metric.therapist.display_name}さん`}
        description={`掲載同意 ${metric.therapist.publication_consent ? "あり" : "なし"} / aliases: ${metric.therapist.aliases.join("、") || "なし"}`}
        actions={
          <Badge tone={metric.therapist.active ? "success" : "neutral"}>
            {metric.therapist.active ? "稼働中" : "停止"}
          </Badge>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "売上", value: formatCurrency(metric.sales), icon: CircleDollarSign },
          { label: "出勤日数", value: `${metric.shiftDays}日`, icon: CalendarDays },
          { label: "出勤時間", value: `${metric.shiftHours.toFixed(1)}h`, icon: Clock3 },
          { label: "掲載回数", value: `${metric.postAppearances}回`, icon: Send },
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
      <Card className="mt-6">
        <CardHeader>
          <div>
            <h2 className="font-serif text-lg font-semibold">掲載・マスタ設定</h2>
            <p className="mt-1 text-xs text-[#777d78]">
              自動検出された新規在籍者は、掲載同意を確認するまで投稿対象になりません。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <TherapistSettingsForm therapist={metric.therapist} />
        </CardContent>
      </Card>
      <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg font-semibold">比較指標</h2>
            <Badge
              tone={
                metric.quality === "比較対象"
                  ? "success"
                  : metric.quality === "参考値"
                    ? "warning"
                    : "neutral"
              }
            >
              {metric.quality}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow label="客単価" value={formatCurrency(metric.averageTicket)} />
            <MetricRow label="時間当たり売上" value={formatCurrency(metric.hourlySales)} />
            <MetricRow label="新規比率" value={percentage(metric.newRatio, 1)} />
            <MetricRow label="再来比率" value={percentage(metric.repeatRatio, 1)} />
            <MetricRow label="指名比率" value={percentage(metric.nominationRatio, 1)} />
            <MetricRow
              label="ランダム掲載群平均"
              value={metric.featuredAverageSales === null ? "評価対象外" : formatCurrency(metric.featuredAverageSales)}
            />
            <MetricRow
              label="ランダム対照群平均"
              value={metric.nonFeaturedAverageSales === null ? "評価対象外" : formatCurrency(metric.nonFeaturedAverageSales)}
            />
            <MetricRow
              label="差分"
              value={metric.difference === null ? "評価対象外" : `${metric.difference >= 0 ? "+" : ""}${formatCurrency(metric.difference)}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">最近の売上レコード</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                予約単位 / 確定データ
              </p>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b bg-[#faf8f4] text-xs text-[#777d78]">
                <tr>
                  <th className="px-5 py-3">日付</th>
                  <th className="px-5 py-3">コース</th>
                  <th className="px-5 py-3">顧客</th>
                  <th className="px-5 py-3">指名</th>
                  <th className="px-5 py-3 text-right">売上</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentSales.map((record) => (
                  <tr key={record.id}>
                    <td className="px-5 py-3 tabular">{record.sales_date}</td>
                    <td className="px-5 py-3">{record.course_minutes}分</td>
                    <td className="px-5 py-3">{record.customer_type ?? "-"}</td>
                    <td className="px-5 py-3">{record.nomination ?? "-"}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular">
                      {formatCurrency(record.sales_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-0">
      <span className="text-sm text-[#777d78]">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
}
