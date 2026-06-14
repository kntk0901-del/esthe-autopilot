import { requireAdmin } from "@/lib/auth/authorize";
import { getPostById, savePost } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    await requireAdmin(request);
    const post = await getPostById((await params).postId);
    if (!post) return Response.json({ message: "Not found" }, { status: 404 });
    if (post.status === "posted") throw new Error("投稿済みは取消できません");
    post.status = "cancelled";
    post.updated_at = new Date().toISOString();
    await savePost(post);
    return Response.json({ post });
  } catch (error) {
    return errorResponse(error);
  }
}
