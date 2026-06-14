import { TherapistTable } from "@/components/therapists/therapist-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getAppData } from "@/lib/db/repository";

export default async function TherapistsPage() {
  const metrics = calculateTherapistMetrics(await getAppData());
  return (
    <>
      <PageHeader
        eyebrow="People Performance"
        title="セラピスト分析"
        description="売上、出勤時間、掲載回数と掲載同意を管理します。売上差はランダムホールドアウト実施時のみ表示します。"
      />
      <Card className="overflow-hidden">
        <TherapistTable data={metrics} />
      </Card>
    </>
  );
}
