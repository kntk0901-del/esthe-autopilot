import { MonthSelector } from "@/components/analytics/month-selector";
import { VariantChart } from "@/components/analytics/variant-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { calculateVariantMetrics } from "@/lib/analytics/post-metrics";
import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getAppData } from "@/lib/db/repository";
import { getJstMonthString } from "@/lib/dates/jst";
import { formatCurrency, percentage } from "@/lib/utils";

// 対象月の初日・末日 (JST) を返す。末日は月ごとに正しく算出する (旧来の -31 固定を廃止)。
function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const data = await getAppData();
  const currentMonth = getJstMonthString();
  const requested = (await searchParams).month;
  const month = /^\d{4}-\d{2}$/.test(requested ?? "")
    ? (requested as string)
    : currentMonth;
  const { from, to } = monthRange(month);
  const stores = calculateStoreMetrics(data, from, to);
  const therapists = calculateTherapistMetrics(data, from, to)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 8);
  const variants = calculateVariantMetrics(data);
  return (
    <>
      <PageHeader
        eyebrow="Performance Lab"
        title="売上・投稿分析"
        description="既定のPoC評価は運用実現性です。売上差はランダムホールドアウト実施時のみ表示します。"
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777d78]">
            対象月
          </p>
          <p className="mt-1 font-serif text-lg font-semibold tabular">{month}</p>
        </div>
        <MonthSelector month={month} currentMonth={currentMonth} />
      </div>
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">店舗別 月次進捗</h2>
              <p className="mt-1 text-xs text-[#777d78]">{month}</p>
            </div>
          </CardHeader>
          <div className="divide-y">
            {stores.map((item) => (
              <div key={item.store.id} className="px-5 py-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-semibold">{item.store.display_name}</p>
                    <p className="mt-1 text-xs text-[#777d78]">
                      {item.bookings}本 / 客単価 {formatCurrency(item.averageTicket)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular">{formatCurrency(item.sales)}</p>
                    <p className="mt-1 text-xs text-[#2f7d6d]">
                      {percentage(item.monthlyProgress, 1)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">
                Variant別 反応比較
              </h2>
              <p className="mt-1 text-xs text-[#777d78]">
                クリックと予約の取得可能範囲
              </p>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <VariantChart data={variants} />
          </CardContent>
        </Card>
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">
                セラピスト売上 上位
              </h2>
              <p className="mt-1 text-xs text-[#777d78]">
                同条件ランダム割当がある場合のみ実験差分を表示
              </p>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-[#faf8f4] text-xs text-[#777d78]">
                <tr>
                  <th className="px-5 py-3">セラピスト</th>
                  <th className="px-5 py-3">店舗</th>
                  <th className="px-5 py-3 text-right">売上</th>
                  <th className="px-5 py-3 text-right">掲載差分</th>
                  <th className="px-5 py-3">サンプル</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {therapists.map((item) => (
                  <tr key={item.therapist.id}>
                    <td className="px-5 py-4 font-semibold">
                      {item.therapist.display_name}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#777d78]">
                      {item.storeName}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular">
                      {formatCurrency(item.sales)}
                    </td>
                    <td
                      className={`px-5 py-4 text-right font-semibold tabular ${
                        item.difference === null
                          ? "text-[#777d78]"
                          : item.difference >= 0
                            ? "text-[#2f7d6d]"
                            : "text-[#b34839]"
                      }`}
                    >
                      {item.difference === null
                        ? "評価対象外"
                        : `${item.difference >= 0 ? "+" : ""}${formatCurrency(item.difference)}`}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          item.quality === "比較対象"
                            ? "success"
                            : item.quality === "参考値"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {item.quality}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">Variant集計</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                売上は手動・直接流入の帰属値
              </p>
            </div>
          </CardHeader>
          <div className="divide-y">
            {variants.map((variant) => (
              <div key={variant.code} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{variant.name}</p>
                    <p className="mt-1 text-xs text-[#777d78]">
                      {variant.posts}投稿 / {variant.clicks}クリック /{" "}
                      {variant.reservations}予約
                    </p>
                  </div>
                  <Badge
                    tone={
                      variant.quality === "比較対象"
                        ? "success"
                        : variant.quality === "参考値"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {variant.quality}
                  </Badge>
                </div>
                <p className="mt-3 text-right font-bold tabular">
                  {formatCurrency(variant.attributedSales)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <p className="mt-5 rounded-xl border bg-[#faf8f4] p-4 text-xs leading-6 text-[#6e746f]">
        注意: operations-onlyモードでは売上貢献を評価しません。Variant別の反応値も1群30投稿未満は探索値で、意思決定には使用しません。粗利は設定した取り分率による概算です。
      </p>
    </>
  );
}
