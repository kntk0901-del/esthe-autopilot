import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";
import type { Shift, Store, Therapist, VariantCode } from "@/lib/types";
import type { SystemSettings } from "@/lib/types";
import { getSecretValue } from "@/lib/settings/secrets";

const systemPrompt = `あなたはメンズエステ店舗のX投稿文を作成するコピーライターです。
入力JSONに含まれる事実だけを使用してください。
店舗名、セラピスト名、出勤時刻、料金、URL、数値を変更または追加してはいけません。
過剰な煽り、虚偽、性的に露骨な表現、在庫や空き枠の断定は禁止です。
指定された投稿パターンに従い、自然な日本語でX投稿文を1案だけ生成してください。
出力は投稿本文のみとし、説明文、引用符、Markdownは含めないでください。`;

export interface AiGenerationInput {
  store: Store;
  date: string;
  shifts: Shift[];
  therapists: Therapist[];
  variant: VariantCode;
  includeUrl: boolean;
  url: string | null;
  settings: SystemSettings;
}

export interface AiGenerationResult {
  text: string;
  model: string;
  prompt: string;
  rawResponse: string;
}

export async function generatePostWithAi(
  input: AiGenerationInput,
): Promise<AiGenerationResult | null> {
  const apiKey = await getSecretValue("geminiApiKey");
  if (!input.settings.useGemini || !apiKey) {
    return null;
  }
  const prompt = `${systemPrompt}\n\n入力JSON:\n${JSON.stringify(
    {
      store: { name: input.store.display_name },
      date: input.date,
      therapists: input.shifts.map((shift) => ({
        name:
          input.therapists.find((item) => item.id === shift.therapist_id)
            ?.display_name ?? shift.therapist_raw,
        start_time: shift.start_time,
        end_time: shift.end_time,
      })),
      variant: input.variant,
      include_url: input.includeUrl,
      url: input.url,
      constraints: { max_chars: 140, max_emojis: 3, max_hashtags: 3 },
    },
    null,
    2,
  )}`;
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: input.settings.geminiModel,
      systemInstruction: systemPrompt,
    });
    const response = await model.generateContent(prompt);
    const rawResponse = response.response.text().trim();
    return {
      text: rawResponse,
      model: input.settings.geminiModel,
      prompt,
      rawResponse,
    };
  } catch (error) {
    logger.error("ai_generation_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
