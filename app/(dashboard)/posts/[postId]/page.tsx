import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageIcon, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { PostEditor } from "@/components/posts/post-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAppData, getPostById } from "@/lib/db/repository";
import { formatJstDateTime } from "@/lib/dates/jst";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const post = await getPostById((await params).postId);
  if (!post) notFound();
  const data = await getAppData();
  const store = data.stores.find((item) => item.id === post.store_id);
  const variant = data.variants.find((item) => item.id === post.variant_id);
  const therapists = post.therapist_ids
    .map((id) => data.therapists.find((item) => item.id === id))
    .filter((item) => Boolean(item));
  return (
    <>
      <Link
        href="/posts"
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#6e746f]"
      >
        <ArrowLeft className="h-4 w-4" />
        投稿一覧へ
      </Link>
      <PageHeader
        eyebrow={`${post.post_date} / ${store?.display_name ?? ""}`}
        title="投稿プレビュー"
        description={`${variant?.name ?? "-"} / ${post.used_ai ? "AI生成" : "固定テンプレート"} / attempt ${post.attempt_count}`}
        actions={
          <>
            {post.approval_status === "pending" ? (
              <ActionButton
                endpoint={`/api/posts/${post.id}/approve`}
                label="承認する"
                variant="secondary"
              />
            ) : null}
            {post.status === "failed" ? (
              <ActionButton
                endpoint={`/api/posts/${post.id}/retry`}
                label="再投稿"
              />
            ) : post.status !== "posted" && post.status !== "cancelled" ? (
              <ActionButton
                endpoint={`/api/posts/${post.id}/publish`}
                label="Xへ投稿"
              />
            ) : null}
          </>
        }
      />
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.7fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={post.status} />
              <StatusBadge status={post.approval_status} />
              <Badge tone={post.include_url ? "info" : "neutral"}>
                {post.include_url ? "URLあり" : "URLなし"}
              </Badge>
              <Badge tone={post.image_urls.length > 0 ? "success" : "neutral"}>
                画像 {post.image_urls.length}枚
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PostEditor
              postId={post.id}
              initialText={post.text_content}
              disabled={post.status === "posted"}
            />
            {post.last_error_message ? (
              <div className="mt-5 rounded-xl border border-[#e7b6ae] bg-[#fff0ed] p-4">
                <p className="text-xs font-bold text-[#a33e31]">
                  {post.last_error_code}
                </p>
                <p className="mt-1 text-sm text-[#7f3c32]">
                  {post.last_error_message}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold">掲載対象</h2>
              <ShieldCheck className="h-5 w-5 text-[#2f7d6d]" />
            </CardHeader>
            <div className="divide-y">
              {therapists.map((therapist) =>
                therapist ? (
                  <div
                    key={therapist.id}
                    className="flex items-center justify-between px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ede9e1] font-serif font-bold">
                        {therapist.display_name.slice(0, 1)}
                      </span>
                      <span className="font-semibold">{therapist.display_name}</span>
                    </div>
                    <Badge tone="success">掲載同意</Badge>
                  </div>
                ) : null,
              )}
            </div>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold">配信情報</h2>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Info label="予定" value={formatJstDateTime(post.scheduled_at)} />
              <Info label="投稿" value={formatJstDateTime(post.posted_at)} />
              <Info label="AI model" value={post.ai_model ?? "-"} />
              <Info label="content hash" value={post.content_hash.slice(0, 18)} mono />
              <Info label="X post id" value={post.x_post_id ?? "-"} mono />
              {post.x_post_url ? (
                <a
                  href={post.x_post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#b64f3b]"
                >
                  X投稿を開く
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-serif text-lg font-semibold">画像</h2>
              <ImageIcon className="h-5 w-5 text-[#b28a45]" />
            </CardHeader>
            <CardContent>
              {post.image_urls.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {post.image_urls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="grid aspect-square place-items-center rounded-xl border bg-[#f6f3ed] p-3 text-center"
                    >
                      <ImageIcon className="mb-2 h-6 w-6 text-[#9b9388]" />
                      <p className="line-clamp-3 break-all text-[10px] text-[#777d78]">
                        {new URL(url).hostname}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#777d78]">テキスト投稿です。</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#777d78]">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-right font-semibold"}>
        {value}
      </span>
    </div>
  );
}
