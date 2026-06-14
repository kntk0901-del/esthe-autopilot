import { getAppData } from "@/lib/db/repository";

export async function GET() {
  return Response.json({ imports: (await getAppData()).imports });
}
