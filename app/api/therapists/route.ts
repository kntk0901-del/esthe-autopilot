import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAppData, saveTherapist } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/lib/auth/authorize";
import type { Therapist } from "@/lib/types";

const therapistSchema = z.object({
  canonical_name: z.string().min(1),
  display_name: z.string().min(1),
  primary_store_id: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  publication_consent: z.boolean().default(true),
  active: z.boolean().default(true),
  priority_flag: z.boolean().default(false),
  newcomer_flag: z.boolean().default(false),
});

export async function GET() {
  return Response.json({ therapists: (await getAppData()).therapists });
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = therapistSchema.parse(await request.json());
    const now = new Date().toISOString();
    const therapist: Therapist = {
      id: randomUUID(),
      ...input,
      profile_url: null,
      profile_image_url: null,
      created_at: now,
      updated_at: now,
    };
    return Response.json(
      { therapist: await saveTherapist(therapist) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
