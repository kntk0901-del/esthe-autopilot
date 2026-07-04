import { getJstDateString } from "@/lib/dates/jst";
import { errorResponse } from "@/lib/errors/app-error";
import { getAppData } from "@/lib/db/repository";
import { runDailyJob } from "@/lib/jobs/daily";
import { authorizeAutomationRequest } from "@/lib/auth/automation";

export const maxDuration = 60;

async function execute(request: Request, rawBody = "") {
  try {
    await authorizeAutomationRequest(request, rawBody);
    const date = getJstDateString();
    const data = await getAppData();
    if (data.systemSettings.schedulerMode === "qstash") {
      return Response.json({
        date,
        status: "skipped",
        reason: "QStashの店舗別スケジュールが有効です",
      });
    }
    // 以前は各店舗の /api/cron/store/{code} へ HTTP fan-out していたが、
    // Vercel Cron 実行時の request.url origin はデプロイ固有URL (Deployment Protection 対象)
    // になり、fan-out がVercelの認証チャレンジHTMLを受け取って response.json() が例外→5XX で
    // 日次処理が全滅していた。サブリクエストを廃し、店舗ジョブをプロセス内で直接実行する。
    const job = await runDailyJob(date);
    return Response.json({ date, job, status: job.status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  return execute(request);
}

// 管理画面の「日次処理を実行」ボタンは POST で叩く (ActionButton の既定)。
// Vercel Cron は GET を使うため、両方を同じロジックに委譲する。
export async function POST(request: Request) {
  const rawBody = await request.text();
  return execute(request, rawBody);
}
