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

const URL_PATTERN = /https?:\/\/[^\s]+/g;

// Xのweighted length準拠でカウントする。
// URLは一律23、CJK等の全角は2、その他は1。上限は280。
export function countCharacters(text: string): number {
  const urls = text.match(URL_PATTERN) ?? [];
  let total = urls.length * 23;
  const rest = text.replace(URL_PATTERN, "");
  for (const ch of rest) {
    const code = ch.codePointAt(0) ?? 0;
    const isWide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3041 && code <= 0x33ff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xa000 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x3fffd);
    total += isWide ? 2 : 1;
  }
  return total;
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
  if (characterCount > (input.maxChars ?? 280)) {
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
    // 本文は "HH:MM" 表記なので、DBの "HH:MM:SS" は先頭5文字で照合する。
    const start = shift.start_time?.slice(0, 5);
    const end = shift.end_time?.slice(0, 5);
    if (start && !input.text.includes(start)) {
      errors.push(`${shift.therapist_raw}の開始時刻が一致しません`);
    }
    if (end && !input.text.includes(end)) {
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
