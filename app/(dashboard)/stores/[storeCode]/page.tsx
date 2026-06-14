import { notFound } from "next/navigation";
import { CalendarClock, CircleDollarSign, Clock3, Send, Users } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { getAppData, getStoreByCode } from "@/lib/db/repository";
import { getJstDateString, getJstMonthString } from "@/lib/dates/jst";
import { formatCurrency, percentage } from "@/lib/utils";

export default async function StorePage({
  params,
}: {
  params: Promise<{ storeCode: string }>;
}) {
  const store = await getStoreByCode((await params).storeCode);
  if (!store) notFound();
  const data = await getAppData();
  const today = getJstDateString();
  const month = getJstMonthString();
  const metric = calculateStoreMetrics(
    data,
    `${month}-01`,
    `${month}-31`,
  ).find((item) => item.store.id === store.id);
  const shifts = data.shifts.filter(
    (shift) => shift.store_id === store.id && shift.shift_date === today,
  );
  const post = data.posts.find(
    (item) => item.store_id === store.id && item.post_date === today,
  );
  return (
    <>
      <PageHeader
        eyebrow={store.code}
        title={store.display_name}
        description={`部屋数 ${store.room_capacity}室 / 投稿予定 ${store.posting_config.postTime} / 月次目標 ${formatCurrency(store.monthly_target)}`}
        actions={
          <>
            <ActionButton
              endpoint="/api/shifts/sync"
              body={{ storeCode: store.code, date: today }}
              label="本日分を同期"
              variant="secondary"
            />
            <ActionButton
              endpoint="/api/posts/generate"
              body={{ storeCode: store.code, date: today, force: true }}
              label="投稿を再生成"
            />
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "月次売上",
            value: formatCurrency(metric?.sales ?? 0),
            icon: CircleDollarSign,
          },
          { label: "本数", value: `${metric?.bookings ?? 0}本`, icon: CalendarClock },
          {
            label: "客単価",
            value: formatCurrency(metric?.averageTicket ?? 0),
            icon: Clock3,
          },
          { label: "本日出勤", value: `${shifts.length}名`, icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs text-[#777d78]">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold tabular">{item.value}</p>
                </div>
                <Icon className="h-6 w-6 text-[#d9654f]" />
              </CardContent>
            </Card>
          );
        })}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">本日の出勤</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                公開可否とデータ品質を含む
              </p>
            </div>
          </CardHeader>
          <div className="divide-y">
            {shifts.map((shift) => {
              const therapist = data.therapists.find(
                (item) => item.id === shift.therapist_id,
              );
              return (
                <div
                  key={shift.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ede9e1] font-serif font-bold text-[#7a675f]">
                      {shift.therapist_raw.slice(0, 1)}
                    </span>
                    <div>
                      <p className="font-semibold">{shift.therapist_raw}</p>
                      <p className="mt-1 text-xs text-[#777d78] tabular">
                        {shift.start_time} 〜 {shift.end_time}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={
                      shift.review_required
                        ? "review"
                        : therapist?.publication_consent
                          ? "approved"
                          : "pending"
                    }
                  />
                </div>
              );
            })}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold">月次進捗</h2>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold">
                  {percentage(metric?.monthlyProgress ?? 0, 1)}
                </p>
                <p className="text-xs text-[#777d78]">
                  目標 {formatCurrency(store.monthly_target)}
                </p>
              </div>
              <div className="mt-4">
                <Progress value={(metric?.monthlyProgress ?? 0) * 100} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <h2 className="font-serif text-lg font-semibold">本日の投稿</h2>
                <p className="mt-1 text-xs text-[#777d78]">
                  X mock / real 共通フロー
                </p>
              </div>
              <Send className="h-5 w-5 text-[#d9654f]" />
            </CardHeader>
            <CardContent>
              {post ? (
                <>
                  <div className="mb-4 flex gap-2">
                    <StatusBadge status={post.status} />
                    <StatusBadge status={post.approval_status} />
                  </div>
                  <p className="whitespace-pre-line text-sm leading-6">
                    {post.text_content}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#777d78]">投稿は未生成です。</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
