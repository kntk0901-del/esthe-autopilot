import { getAppData } from "@/lib/db/repository";

export async function GET() {
  return Response.json({ stores: (await getAppData()).stores });
}
