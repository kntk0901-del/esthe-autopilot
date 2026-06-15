"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, Search, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PostVariant, SocialPost, Store, Therapist } from "@/lib/types";
import { formatJstDateTime } from "@/lib/dates/jst";

export function PostsTable({
  posts,
  stores,
  therapists,
  variants,
  clickCounts,
}: {
  posts: SocialPost[];
  stores: Store[];
  therapists: Therapist[];
  variants: PostVariant[];
  clickCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [store, setStore] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function handleDelete(id: string) {
    if (!window.confirm("この投稿を削除しますか?(取り消せません)")) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      window.alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }
  const filtered = useMemo(
    () =>
      posts.filter((post) => {
        const storeName =
          stores.find((item) => item.id === post.store_id)?.display_name ?? "";
        return (
          (status === "all" || post.status === status) &&
          (store === "all" || post.store_id === store) &&
          (!query ||
            post.text_content.toLowerCase().includes(query.toLowerCase()) ||
            storeName.includes(query))
        );
      }),
    [posts, query, status, store, stores],
  );
  return (
    <div>
      <div className="flex flex-col gap-3 border-b bg-[#faf8f4] p-4 md:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#858b86]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="投稿文・店舗を検索"
            className="h-9 w-full rounded-lg border bg-white pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={store}
          onChange={(event) => setStore(event.target.value)}
          className="h-9 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="all">全店舗</option>
          {stores.map((item) => (
            <option key={item.id} value={item.id}>
              {item.display_name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 rounded-lg border bg-white px-3 text-sm"
        >
          <option value="all">全ステータス</option>
          <option value="scheduled">予約済み</option>
          <option value="posted">投稿済み</option>
          <option value="failed">失敗</option>
          <option value="cancelled">取消</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b bg-white text-[11px] uppercase tracking-wider text-[#777d78]">
            <tr>
              <th className="px-5 py-3 font-bold">投稿日 / 店舗</th>
              <th className="px-5 py-3 font-bold">投稿内容</th>
              <th className="px-5 py-3 font-bold">掲載</th>
              <th className="px-5 py-3 font-bold">Variant</th>
              <th className="px-5 py-3 font-bold">状態</th>
              <th className="px-5 py-3 text-right font-bold">Clicks</th>
              <th className="px-5 py-3 font-bold">作成</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((post) => {
              const itemStore = stores.find((item) => item.id === post.store_id);
              const variant = variants.find((item) => item.id === post.variant_id);
              const names = post.therapist_ids
                .map((id) => therapists.find((item) => item.id === id)?.display_name)
                .filter(Boolean)
                .join("、");
              return (
                <tr key={post.id} className="bg-[#fffdf9] hover:bg-[#faf8f4]">
                  <td className="px-5 py-4">
                    <p className="font-semibold tabular">{post.post_date}</p>
                    <p className="mt-1 text-xs text-[#6e746f]">
                      {itemStore?.display_name}
                    </p>
                  </td>
                  <td className="max-w-[360px] px-5 py-4">
                    <p className="line-clamp-2 leading-6">{post.text_content}</p>
                    <p className="mt-1 text-[11px] text-[#858b86]">
                      {post.used_ai ? "AI生成" : "固定テンプレート"} /{" "}
                      {post.include_url ? "URLあり" : "URLなし"} / 画像
                      {post.image_urls.length}枚
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs">{names || "-"}</td>
                  <td className="px-5 py-4 text-xs font-semibold">
                    {variant?.name ?? "-"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular">
                    {clickCounts[post.id] ?? 0}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#6e746f] tabular">
                    {formatJstDateTime(post.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/posts/${post.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#b64f3b] hover:underline"
                      >
                        詳細
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                        className="inline-flex items-center gap-1 text-[#9a9a9a] hover:text-[#c0392b] disabled:opacity-50"
                        aria-label="削除"
                      >
                        {deletingId === post.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
