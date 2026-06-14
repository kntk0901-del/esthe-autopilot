import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  MousePointerClick,
  ReceiptText,
  Send,
  Users,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { getAppData } from "@/lib/db/repository";
import {
  formatJstDate,
  getJstDateString,
  getJstMonthString,
} from "@/lib/dates/jst";
import { formatCurrency, formatNumber, percentage } from "@/lib/utils";

const storeColors = ["#d9654f", "#2f7d6d", "#b28a45"];

export default async function DashboardPage() {
  const data = await getAppData();
  const today = getJstDateString();
  const month = getJstMonthString();
  const daily = calculateStoreMetrics(data, today, today);
  const monthly = calculateStoreMetrics(data, `${month}-01`, `${month}-31`);
  const todaySales = daily.reduce((sum, item) => sum + item.sales, 0);
  const monthSales = monthly.reduce((sum, item) => sum + item.sales, 0);
  const todayBookings = daily.reduce((sum, item) => sum + item.bookings, 0);
  const todayShifts = data.shifts.filter((shift) => shift.shift_date === today);
  const todayPosts = data.posts.filter((post) => post.post_date === today);
  const monthTarget = data.stores.reduce(
    (sum, store) => sum + store.monthly_target,
    0,
  );
  const alerts = [
    ...data.jobs
      .filter((job) => ["failed", "partial"].includes(job.status))
      .slice(0, 3)
      .map((job) => ({
        title: job.error_message ?? `${job.job_type}で異常`,
        label: "JOB",
      })),
    ...data.posts
      .filter((post) => post.status === "failed")
      .slice(0, 2)
      .map((post) => ({
        title: post.last_error_message ?? "投稿に失敗しました",
        label: "POST",
      })),
  ];
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = format(subDays(new Date(`${today}T00:00:00`), 13 - index), "yyyy-MM-dd");
    return {
      date: format(new Date(`${date}T00:00:00`), "M/d"),
      sales: data.salesRecords
        .filter((record) => record.sales_date === date)
        .reduce((sum, record) => sum + record.sales_amount, 0),
    };
  });
  const kpis = [
    {
      label: "本日売上",
      value: formatCurrency(todaySales),
      detail: `${todayBookings}本`,
      icon: CircleDollarSign,
      accent: "#d9654f",
    },
    {
      label: "月次売上",
      value: formatCurrency(monthSales),
      detail: `目標進捗 ${percentage(monthSales / monthTarget, 1)}`,
      icon: ReceiptText,
      accent: "#2f7d6d",
    },
    {
      label: "客単価",
      value: formatCurrency(
        todayBookings > 0 ? todaySales / todayBookings : 0,
      ),
      detail: "3店舗合計",
      icon: CalendarDays,
      accent: "#b28a45",
    },
    {
      label: "本日出勤",
      value: `${todayShifts.length}名`,
      detail: `掲載同意 ${todayShifts.filter((shift) => data.therapists.find((item) => item.id === shift.therapist_id)?.publication_consent).length}名`,
      icon: Users,
      accent: "#516f8a",
    },
    {
      label: "投稿状態",
      value: `${todayPosts.filter((post) => post.status === "posted").length}/${data.stores.length}`,
      detail: `エラー ${todayPosts.filter((post) => post.status === "failed").length}件`,
      icon: Send,
      accent: "#755f87",
    },
    {
      label: "今月クリック",
      value: formatNumber(
        data.clicks.filter(
          (click) => click.counted && click.clicked_at.startsWith(month),
        ).length,
      ),
      detail: "トラッキングURL",
      icon: MousePointerClick,
      accent: "#7a6c52",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={formatJstDate(today, "yyyy年M月d日")}
        title="全店ダッシュボード"
        description="出勤、投稿、売上、異常を3店舗横断で確認します。数値はJST業務日、保存時刻はUTCです。"
        actions={<DashboardActions date={today} />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#6e746f]">
                    {kpi.label}
                  </p>
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg"
                    style={{ backgroundColor: `${kpi.accent}16`, color: kpi.accent }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight tabular">
                  {kpi.value}
                </p>
                <p className="mt-1 text-[11px] text-[#858b86]">{kpi.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">14日間の売上推移</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                予約単位レコードのみを集計
              </p>
            </div>
            <span className="text-xs font-semibold text-[#2f7d6d]">
              今月 {formatCurrency(monthSales)}
            </span>
          </CardHeader>
          <CardContent className="pb-2">
            <SalesTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">要確認</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                運用を止める可能性のある項目
              </p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff0ed] text-[#b34839]">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </CardHeader>
          <div className="divide-y">
            {alerts.length > 0 ? (
              alerts.map((alert, index) => (
                <div key={`${alert.title}-${index}`} className="flex gap-3 px-5 py-4">
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#d9654f]" />
                  <div>
                    <p className="text-sm font-semibold leading-5">{alert.title}</p>
                    <p className="mt-1 text-[10px] font-bold tracking-wider text-[#9a7d76]">
                      {alert.label}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-sm text-[#777d78]">
                現在アラートはありません
              </p>
            )}
          </div>
          <div className="border-t px-5 py-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#b64f3b]"
            >
              ジョブログを確認
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold">店舗別サマリー</h2>
            <p className="mt-1 text-xs text-[#777d78]">
              月次進捗と本日の稼働状況
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {monthly.map((item, index) => {
            const todayItem = daily.find(
              (dailyItem) => dailyItem.store.id === item.store.id,
            );
            const post = todayPosts.find(
              (candidate) => candidate.store_id === item.store.id,
            );
            const shiftCount = todayShifts.filter(
              (shift) => shift.store_id === item.store.id,
            ).length;
            return (
              <Card key={item.store.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.2em]"
                        style={{ color: storeColors[index] }}
                      >
                        {item.store.code}
                      </p>
                      <h3 className="mt-1 font-serif text-xl font-semibold">
                        {item.store.display_name}
                      </h3>
                    </div>
                    {post ? <StatusBadge status={post.status} /> : null}
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-[#858b86]">本日出勤</p>
                      <p className="mt-1 text-lg font-bold">{shiftCount}名</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#858b86]">本日売上</p>
                      <p className="mt-1 text-lg font-bold tabular">
                        ¥{Math.round((todayItem?.sales ?? 0) / 1000)}k
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#858b86]">本数</p>
                      <p className="mt-1 text-lg font-bold">
                        {todayItem?.bookings ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-[#777d78]">月次進捗</span>
                      <span className="font-bold">
                        {percentage(item.monthlyProgress, 1)}
                      </span>
                    </div>
                    <Progress
                      value={item.monthlyProgress * 100}
                      color={storeColors[index]}
                    />
                  </div>
                  <Link
                    href={`/stores/${item.store.code}`}
                    className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#b64f3b]"
                  >
                    店舗詳細
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">本日の投稿</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                生成内容と投稿状態
              </p>
            </div>
            <Link href="/posts" className="text-xs font-bold text-[#b64f3b]">
              すべて表示
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-[#faf8f4] text-[11px] text-[#777d78]">
                <tr>
                  <th className="px-5 py-3">店舗</th>
                  <th className="px-5 py-3">予定時刻</th>
                  <th className="px-5 py-3">掲載セラピスト</th>
                  <th className="px-5 py-3">状態</th>
                  <th className="px-5 py-3">投稿URL</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {todayPosts.map((post) => (
                  <tr key={post.id}>
                    <td className="px-5 py-4 font-semibold">
                      {
                        data.stores.find((store) => store.id === post.store_id)
                          ?.display_name
                      }
                    </td>
                    <td className="px-5 py-4 tabular">
                      {post.scheduled_at
                        ? new Intl.DateTimeFormat("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(post.scheduled_at))
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {post.therapist_ids
                        .map(
                          (id) =>
                            data.therapists.find((item) => item.id === id)
                              ?.display_name,
                        )
                        .filter(Boolean)
                        .join("、")}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/posts/${post.id}`}
                        className="font-semibold text-[#b64f3b]"
                      >
                        プレビュー
                      </Link>
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
