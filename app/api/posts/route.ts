import { getAppData } from "@/lib/db/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const store = url.searchParams.get("store");
  const date = url.searchParams.get("date");
  const data = await getAppData();
  const storeId = store
    ? data.stores.find((item) => item.code === store)?.id
    : null;
  return Response.json({
    posts: data.posts.filter(
      (post) =>
        (!status || post.status === status) &&
        (!storeId || post.store_id === storeId) &&
        (!date || post.post_date === date),
    ),
  });
}
