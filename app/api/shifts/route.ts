import { getAppData } from "@/lib/db/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const storeCode = url.searchParams.get("store");
  const data = await getAppData();
  const storeId = storeCode
    ? data.stores.find((store) => store.code === storeCode)?.id
    : null;
  const shifts = data.shifts.filter(
    (shift) =>
      (!date || shift.shift_date === date) &&
      (!storeId || shift.store_id === storeId),
  );
  return Response.json({ shifts });
}
