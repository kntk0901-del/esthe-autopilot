import { getImportById } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const batch = await getImportById((await params).batchId);
  return batch
    ? Response.json({ batch, message: "アップロード時に解析済みです" })
    : Response.json({ message: "Not found" }, { status: 404 });
}
