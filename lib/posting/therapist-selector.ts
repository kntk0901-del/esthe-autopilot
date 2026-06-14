import { differenceInCalendarDays, parseISO } from "date-fns";
import { createHash } from "node:crypto";
import { minutesBetween } from "@/lib/dates/jst";
import type {
  SalesRecord,
  Shift,
  SocialPost,
  Therapist,
} from "@/lib/types";

export interface TherapistSelection {
  therapist: Therapist;
  shift: Shift;
  score: number;
  reason: string;
}

export interface HoldoutAssignment {
  treatment: TherapistSelection[];
  control: TherapistSelection[];
}

function deterministicSide(seed: string): boolean {
  return Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % 2 === 0;
}

export function assignRandomizedHoldout(input: {
  date: string;
  shifts: Shift[];
  therapists: Therapist[];
  posts: SocialPost[];
  salesRecords: SalesRecord[];
  max?: number;
}): HoldoutAssignment {
  const candidates = selectTherapists({ ...input, max: input.shifts.length }).sort(
    (a, b) => {
      const aKey = `${a.therapist.newcomer_flag ? 1 : 0}:${a.therapist.priority_flag ? 1 : 0}:${Math.round(a.score / 5)}`;
      const bKey = `${b.therapist.newcomer_flag ? 1 : 0}:${b.therapist.priority_flag ? 1 : 0}:${Math.round(b.score / 5)}`;
      return aKey.localeCompare(bKey) || a.therapist.id.localeCompare(b.therapist.id);
    },
  );
  const treatment: TherapistSelection[] = [];
  const control: TherapistSelection[] = [];
  for (let index = 0; index + 1 < candidates.length; index += 2) {
    const pair = candidates.slice(index, index + 2);
    const firstIsTreatment = deterministicSide(
      `${input.date}:${pair.map((item) => item.therapist.id).sort().join(":")}`,
    );
    treatment.push(firstIsTreatment ? pair[0] : pair[1]);
    control.push(firstIsTreatment ? pair[1] : pair[0]);
    if (treatment.length >= (input.max ?? 4)) break;
  }
  return { treatment, control };
}

export function selectTherapists(input: {
  date: string;
  shifts: Shift[];
  therapists: Therapist[];
  posts: SocialPost[];
  salesRecords: SalesRecord[];
  max?: number;
}): TherapistSelection[] {
  const eligible = input.shifts
    .map((shift) => ({
      shift,
      therapist: input.therapists.find(
        (therapist) => therapist.id === shift.therapist_id,
      ),
    }))
    .filter(
      (
        pair,
      ): pair is {
        shift: Shift;
        therapist: Therapist;
      } =>
        // 掲載同意は契約時取得の運用前提のため投稿可否のゲートにはしない。
        // 在籍中(active)かつ実データ異常で要確認になっていないshiftを対象とする。
        Boolean(pair.therapist?.active && !pair.shift.review_required),
    );

  return eligible
    .map(({ therapist, shift }) => {
      const previousPosts = input.posts
        .filter(
          (post) =>
            post.therapist_ids.includes(therapist.id) &&
            post.post_date < input.date,
        )
        .sort((a, b) => b.post_date.localeCompare(a.post_date));
      const daysSinceLast = previousPosts[0]
        ? Math.min(
            30,
            differenceInCalendarDays(
              parseISO(input.date),
              parseISO(previousPosts[0].post_date),
            ),
          )
        : 30;
      const recentCount = previousPosts.filter(
        (post) =>
          differenceInCalendarDays(
            parseISO(input.date),
            parseISO(post.post_date),
          ) <= 30,
      ).length;
      const sales30d = input.salesRecords
        .filter(
          (record) =>
            record.therapist_id === therapist.id &&
            differenceInCalendarDays(
              parseISO(input.date),
              parseISO(record.sales_date),
            ) <= 30,
        )
        .reduce((sum, record) => sum + record.sales_amount, 0);
      const underTargetScore = Math.max(0, 200_000 - sales30d) / 100_000;
      const hours = (minutesBetween(shift.start_time, shift.end_time) ?? 0) / 60;
      const score =
        daysSinceLast * 3 +
        (therapist.priority_flag ? 10 : 0) +
        (therapist.newcomer_flag ? 8 : 0) +
        Math.max(0, 10 - recentCount) * 2 +
        underTargetScore * 2 +
        hours;
      const reasons = [
        daysSinceLast >= 7 ? "前回掲載から期間あり" : null,
        recentCount <= 2 ? "直近30日掲載回数が少ない" : null,
        therapist.priority_flag ? "重点販促対象" : null,
        therapist.newcomer_flag ? "新人" : null,
        hours >= 8 ? "出勤時間が長い" : null,
      ].filter((reason): reason is string => Boolean(reason));
      return {
        therapist,
        shift,
        score,
        reason: reasons.join(" / ") || "掲載バランス",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.max ?? 4);
}
