import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorize";
import {
  getAppData,
  getStoreByCode,
  savePost,
} from "@/lib/db/repository";
import { getJstDateString } from "@/lib/dates/jst";
import { errorResponse } from "@/lib/errors/app-error";
import { planPost } from "@/lib/posting/planner";

const schema = z.object({
  storeCode: z.enum(["kamata", "oimachi", "sugamo"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(getJstDateString()),
  force: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    const store = await getStoreByCode(input.storeCode);
    if (!store) throw new Error("店舗が見つかりません");
    const post = await planPost({
      data: await getAppData(),
      store,
      date: input.date,
      force: input.force,
    });
    await savePost(post);
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
