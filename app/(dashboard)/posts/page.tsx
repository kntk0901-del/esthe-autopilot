import { GeneratePostControl } from "@/components/posts/generate-post-control";
import { PostsTable } from "@/components/posts/posts-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAppData } from "@/lib/db/repository";
import { getJstDateString } from "@/lib/dates/jst";

export default async function PostsPage() {
  const data = await getAppData();
  const today = getJstDateString();
  const clickCounts = Object.fromEntries(
    data.posts.map((post) => [
      post.id,
      data.clicks.filter(
        (click) => click.post_id === post.id && click.counted,
      ).length,
    ]),
  );
  return (
    <>
      <PageHeader
        eyebrow="Content Operations"
        title="投稿管理"
        description="生成根拠、掲載セラピスト、AI利用、URL・画像有無、X結果を追跡します。"
        actions={<GeneratePostControl stores={data.stores} date={today} />}
      />
      <Card className="overflow-hidden">
        <PostsTable
          posts={data.posts}
          stores={data.stores}
          therapists={data.therapists}
          variants={data.variants}
          clickCounts={clickCounts}
        />
      </Card>
    </>
  );
}
