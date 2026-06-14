export const ERROR_CODES = {
  SCHEDULE_FETCH_FAILED: "スケジュール取得失敗",
  SCHEDULE_PARSE_FAILED: "HTML解析失敗",
  TODAY_TAB_NOT_FOUND: "当日タブなし",
  THERAPIST_NOT_MATCHED: "セラピストマスタ未一致",
  INVALID_SHIFT_TIME: "出勤時刻異常",
  IMAGE_FETCH_FAILED: "画像取得失敗",
  AI_GENERATION_FAILED: "AI生成失敗",
  AI_VALIDATION_FAILED: "AI文検証失敗",
  X_AUTH_FAILED: "X認証失敗",
  X_MEDIA_UPLOAD_FAILED: "X画像登録失敗",
  X_POST_FAILED: "X投稿失敗",
  DUPLICATE_POST: "重複投稿",
  IMPORT_PARSE_FAILED: "売上取込解析失敗",
  IMPORT_REVIEW_REQUIRED: "要確認行あり",
  DB_ERROR: "DB異常",
  LOCK_ACQUISITION_FAILED: "排他ロック失敗",
  POSTING_DISABLED: "投稿キルスイッチ作動中",
  DAILY_POST_LIMIT: "日次投稿上限に到達",
  X_BUDGET_LIMIT: "X月次予算上限に到達",
  X_ACCOUNT_RESTRICTED: "Xアカウント抑制中",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly causeData?: unknown,
  ) {
    super(message ?? ERROR_CODES[code]);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.code === "DUPLICATE_POST" ? 409 : 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return Response.json(
    { ok: false, code: "INTERNAL_ERROR", message },
    { status: 500 },
  );
}
