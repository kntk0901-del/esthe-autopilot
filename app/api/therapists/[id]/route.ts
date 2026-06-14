import { z } from "zod";
import {
  getTherapistById,
  saveTherapist,
} from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/lib/auth/authorize";

const patchSchema = z.object({
  display_name: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  publication_consent: z.boolean().optional(),
  active: z.boolean().optional(),
  priority_flag: z.boolean().optional(),
  newcomer_flag: z.boolean().optional(),
  profile_url: z.string().url().nullable().optional(),
  profile_image_url: z.string().url().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const therapist = await getTherapistById((await params).id);
  return therapist
    ? Response.json({ therapist })
    : Response.json({ message: "Not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const therapist = await getTherapistById((await params).id);
    if (!therapist) {
      return Response.json({ message: "Not found" }, { status: 404 });
    }
    const patch = patchSchema.parse(await request.json());
    Object.assign(therapist, patch, { updated_at: new Date().toISOString() });
    return Response.json({ therapist: await saveTherapist(therapist) });
  } catch (error) {
    return errorResponse(error);
  }
}
