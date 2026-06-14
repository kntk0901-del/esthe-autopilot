import { getPostById, savePost } from "@/lib/db/repository";
import { requireAdmin } from "@/lib/auth/authorize";
import { errorResponse } from "@/lib/errors/app-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const post = await getPostById((await params).postId);
  return post
    ? Response.json({ post })
    : Response.json({ message: "Not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    await requireAdmin(request);
    const post = await getPostById((await params).postId);
    if (!post) return Response.json({ message: "Not found" }, { status: 404 });
    const patch = (await request.json()) as {
      text_content?: string;
      scheduled_at?: string;
      include_url?: boolean;
      image_urls?: string[];
    };
    Object.assign(post, patch, { updated_at: new Date().toISOString() });
    await savePost(post);
    return Response.json({ post });
  } catch (error) {
    return errorResponse(error);
  }
}
