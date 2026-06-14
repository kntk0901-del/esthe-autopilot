import { requireAdmin } from "@/lib/auth/authorize";
import { errorResponse } from "@/lib/errors/app-error";
import { publishPostById } from "@/lib/posting/publisher";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    await requireAdmin(request);
    return Response.json({
      post: await publishPostById((await params).postId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
