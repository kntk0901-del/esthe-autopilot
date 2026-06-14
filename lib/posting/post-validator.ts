import type { Shift, Store, Therapist } from "@/lib/types";

const prohibitedPatterns = [
  /絶対/,
  /確実/,
  /残り[0-9０-９]+枠/,
  /空き(?:あり|ございます)/,
  /今すぐ予約可能/,
  /性的/,
  /必ず満足/,
];

export interface PostValidationResult {
  valid: boolean;
  errors: string[];
  characterCount: number;
  emojiCount: number;
  hashtagCount: number;
}

export function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function validatePostText(input: {
  text: string;
  store: Store;
  shifts: Shift[];
  selectedTherapists: Therapist[];
  allTherapists: Therapist[];
  includeUrl: boolean;
  url: string | null;
  maxChars?: number;
  maxEmojis?: number;
  maxHashtags?: number;
}): PostValidationResult {
  const errors: string[] = [];
  const characterCount = countCharacters(input.text);
  const emojiCount =
    input.text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  const hashtagCount = input.text.match(/#[^\s#]+/g)?.length ?? 0;
  if (characterCount > (input.maxChars ?? 140)) {
    errors.push(`文字数超過: ${characterCount}`);
  }
  if (!input.text.includes(input.store.display_name)) {
    errors.push("店舗名が一致しません");
  }
  input.selectedTherapists.forEach((therapist) => {
    if (!input.text.includes(therapist.display_name)) {
      errors.push(`${therapist.display_name}が本文に含まれていません`);
    }
  });
  const selectedIds = new Set(input.selectedTherapists.map((item) => item.id));
  input.allTherapists
    .filter((therapist) => !selectedIds.has(therapist.id))
    .forEach((therapist) => {
      if (
        therapist.display_name.length >= 2 &&
        input.text.includes(therapist.display_name)
      ) {
        errors.push(`未掲載者 ${therapist.display_name} が含まれています`);
      }
    });
  input.shifts.forEach((shift) => {
    if (shift.start_time && !input.text.includes(shift.start_time)) {
      errors.push(`${shift.therapist_raw}の開始時刻が一致しません`);
    }
    if (shift.end_time && !input.text.includes(shift.end_time)) {
      errors.push(`${shift.therapist_raw}の終了時刻が一致しません`);
    }
  });
  if (input.includeUrl && input.url && !input.text.includes(input.url)) {
    errors.push("URLが一致しません");
  }
  if (!input.includeUrl && /https?:\/\//.test(input.text)) {
    errors.push("URLなし設定ですがURLが含まれています");
  }
  prohibitedPatterns.forEach((pattern) => {
    if (pattern.test(input.text)) {
      errors.push(`禁止表現: ${pattern.source}`);
    }
  });
  if (/[¥￥]\s?[\d,]+|\d{4,}\s?円/.test(input.text)) {
    errors.push("入力にない料金が生成された可能性があります");
  }
  if (emojiCount > (input.maxEmojis ?? 3)) {
    errors.push(`絵文字数超過: ${emojiCount}`);
  }
  if (hashtagCount > (input.maxHashtags ?? 3)) {
    errors.push(`ハッシュタグ数超過: ${hashtagCount}`);
  }
  return {
    valid: errors.length === 0,
    errors,
    characterCount,
    emojiCount,
    hashtagCount,
  };
}
