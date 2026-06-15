import { MonthSelector } from "@/components/analytics/month-selector";
import { TherapistTable } from "@/components/therapists/therapist-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getAppData } from "@/lib/db/repository";
import { getJstMonthString, jstMonthRange, resolveMonth } from "@/lib/dates/jst";

export default async function TherapistsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const data = await getAppData();
  const currentMonth = getJstMonthString();
  const month = resolveMonth((await searchParams).month, currentMonth);
  const { from, to } = jstMonthRange(month);
  const metrics = calculateTherapistMetrics(data, from, to);
  return (
    <>
      <PageHeader
        eyebrow="People Performance"
        title="セラピスト分析"
        description="売上、出勤時間、掲載回数と掲載同意を管理します。売上差はランダムホールドアウト実施時のみ表示します。"
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777d78]">
            対象月
          </p>
          <p className="mt-1 font-serif text-lg font-semibold tabular">{month}</p>
        </div>
        <MonthSelector
          month={month}
          currentMonth={currentMonth}
          basePath="/therapists"
        />
      </div>
      <Card className="overflow-hidden">
        <TherapistTable data={metrics} />
      </Card>
    </>
  );
}
