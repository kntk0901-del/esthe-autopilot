import type { Shift, Store, Therapist } from "@/lib/types";

export interface FixedTemplateInput {
  store: Store;
  shifts: Shift[];
  therapists: Therapist[];
  includeUrl: boolean;
  trackingUrl?: string | null;
}

export function formatShiftRange(shift: Shift): string {
  return `${shift.start_time ?? "時間未定"}〜${shift.end_time ?? "時間未定"}`;
}

export function createFixedPost(input: FixedTemplateInput): string {
  const therapistLines = input.shifts
    .map((shift) => {
      const therapist = input.therapists.find(
        (item) => item.id === shift.therapist_id,
      );
      return `・${therapist?.display_name ?? shift.therapist_raw} ${formatShiftRange(
        shift,
      )}`;
    })
    .join("\n");
  const cta =
    input.includeUrl && input.trackingUrl
      ? `詳細・ご予約はこちら\n${input.trackingUrl}`
      : "詳細はプロフィールからご確認ください。";
  const hashtags = input.store.posting_config.hashtags
    .slice(0, 3)
    .map((tag) => `#${tag.replace(/^#/, "")}`)
    .join(" ");
  return [
    "【本日の出勤情報】",
    "",
    input.store.display_name,
    "",
    therapistLines,
    "",
    "本日もご予約をお待ちしております。",
    cta,
    hashtags,
  ]
    .filter((line, index, values) => line || values[index - 1] !== "")
    .join("\n")
    .trim();
}
