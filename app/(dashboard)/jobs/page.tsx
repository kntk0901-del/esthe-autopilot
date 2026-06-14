import { AlertTriangle, CheckCircle2, Clock3, PlayCircle } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAppData } from "@/lib/db/repository";
import { formatJstDateTime } from "@/lib/dates/jst";

export default async function JobsPage() {
  const data = await getAppData();
  const success = data.jobs.filter((job) => job.status === "success").length;
  const failed = data.jobs.filter((job) => job.status === "failed").length;
  const partial = data.jobs.filter((job) => job.status === "partial").length;
  return (
    <>
      <PageHeader
        eyebrow="Automation Health"
        title="同期・ジョブログ"
        description="Cron、スクレイピング、取込、生成、X投稿の実行結果とエラーを追跡します。"
        actions={
          <ActionButton endpoint="/api/cron/daily" label="日次処理を実行" />
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "成功", value: success, icon: CheckCircle2, color: "#2f7d6d" },
          { label: "一部失敗", value: partial, icon: AlertTriangle, color: "#b28a45" },
          { label: "失敗", value: failed, icon: AlertTriangle, color: "#d9654f" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs text-[#777d78]">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold">{item.value}</p>
                </div>
                <Icon className="h-7 w-7" style={{ color: item.color }} />
              </CardContent>
            </Card>
          );
        })}
      </section>
      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-serif text-lg font-semibold">実行履歴</h2>
            <p className="mt-1 text-xs text-[#777d78]">新しい順</p>
          </div>
          <Clock3 className="h-5 w-5 text-[#777d78]" />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-[#faf8f4] text-xs text-[#777d78]">
              <tr>
                <th className="px-5 py-3">ジョブ</th>
                <th className="px-5 py-3">店舗</th>
                <th className="px-5 py-3">対象日</th>
                <th className="px-5 py-3">結果</th>
                <th className="px-5 py-3">件数</th>
                <th className="px-5 py-3">開始 / 終了</th>
                <th className="px-5 py-3">エラー</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <PlayCircle className="h-4 w-4 text-[#d9654f]" />
                      {job.job_type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    {data.stores.find((store) => store.id === job.store_id)
                      ?.display_name ?? "全店舗"}
                  </td>
                  <td className="px-5 py-4 tabular">{job.target_date ?? "-"}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-5 py-4 text-xs tabular">
                    {job.success_count} success / {job.error_count} error
                  </td>
                  <td className="px-5 py-4 text-xs text-[#777d78]">
                    {formatJstDateTime(job.started_at)}
                    <br />
                    {formatJstDateTime(job.finished_at)}
                  </td>
                  <td className="max-w-sm px-5 py-4 text-xs leading-5 text-[#a33e31]">
                    {job.error_message ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
