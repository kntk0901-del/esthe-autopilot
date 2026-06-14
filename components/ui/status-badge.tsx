import { Badge } from "@/components/ui/badge";

const map: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }
> = {
  draft: { label: "下書き", tone: "neutral" },
  scheduled: { label: "予約済み", tone: "info" },
  processing: { label: "処理中", tone: "warning" },
  posted: { label: "投稿済み", tone: "success" },
  failed: { label: "失敗", tone: "danger" },
  cancelled: { label: "取消", tone: "neutral" },
  success: { label: "成功", tone: "success" },
  partial: { label: "一部失敗", tone: "warning" },
  skipped: { label: "スキップ", tone: "neutral" },
  running: { label: "実行中", tone: "info" },
  uploaded: { label: "アップロード済み", tone: "info" },
  parsed: { label: "解析済み", tone: "success" },
  review: { label: "要確認", tone: "warning" },
  confirmed: { label: "確定済み", tone: "success" },
  pending: { label: "承認待ち", tone: "warning" },
  approved: { label: "承認済み", tone: "success" },
  auto: { label: "自動承認", tone: "info" },
  rejected: { label: "却下", tone: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const item = map[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}
