import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorize";
import { getAppData, updateSystemSettings } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { getSecretStatus } from "@/lib/settings/secrets";

const patchSchema = z.object({
  measurementMode: z.enum(["operations_only", "randomized_holdout"]).optional(),
  schedulerMode: z.enum(["vercel_daily", "qstash"]).optional(),
  appBaseUrl: z.string().url().optional(),
  postingEnabled: z.boolean().optional(),
  dailyPostLimit: z.number().int().min(0).max(100).optional(),
  monthlyXBudgetYen: z.number().min(0).optional(),
  estimatedXCostPerPostYen: z.number().min(0).optional(),
  useGemini: z.boolean().optional(),
  geminiModel: z.string().min(1).optional(),
  xMockMode: z.boolean().optional(),
  xApiBaseUrl: z.string().url().optional(),
  xUploadBaseUrl: z.string().url().optional(),
  botFilterEnabled: z.boolean().optional(),
  botUserAgentPatterns: z.array(z.string().min(1)).optional(),
  reachMonitoringEnabled: z.boolean().optional(),
  minimumImpressionsAfter24h: z.number().int().min(0).optional(),
  grossProfitIsEstimate: z.boolean().optional(),
  defaultTherapistPaymentRate: z.number().min(0).max(1).optional(),
});

export async function GET() {
  const data = await getAppData();
  return Response.json({
    settings: data.systemSettings,
    secretStatus: await getSecretStatus(),
  });
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const patch = patchSchema.parse(await request.json());
    return Response.json({ settings: await updateSystemSettings(patch) });
  } catch (error) {
    return errorResponse(error);
  }
}
