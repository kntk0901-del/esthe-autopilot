import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FileWarning } from "lucide-react";
import { AiImport } from "@/components/imports/ai-import";
import { ImportUploader } from "@/components/imports/import-uploader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAppData } from "@/lib/db/repository";
import { formatJstDateTime } from "@/lib/dates/jst";

export default async function ImportsPage() {
  const data = await getAppData();
  return (
    <>
      <PageHeader
        eyebrow="Data Intake"
        title="売上取込"
        description="CSV / Excelを自動正規化し、推定・欠損・異常を人間確認してから確定します。"
      />
      <section className="grid gap-6 xl:grid-cols-[1fr_0.55fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">新しいファイル</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                同一ファイルの重複取込はハッシュで防止
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ImportUploader stores={data.stores} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg font-semibold">取込ルール</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "合計・小計・空行は自動除外",
              "年なし日付は対象年度で補完",
              "店舗・セラピスト名をマスタ照合",
              "推定値と異常値をレビューへ送る",
              "確定前は売上集計へ含めない",
            ].map((rule) => (
              <div key={rule} className="flex gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7d6d]" />
                <span>{rule}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="mt-6">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">
                AIで取込(フォーマット自由・無料)
              </h2>
              <p className="mt-1 text-xs text-[#777d78]">
                列構成が変わる売上表や、議事録・LINE報告などの自由文に対応。プロンプトを生成し、お使いのChatGPT/Claudeで構造化→結果を貼り戻すだけ(API不要)。
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <AiImport />
          </CardContent>
        </Card>
      </section>
      <section className="mt-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="font-serif text-lg font-semibold">取込履歴</h2>
              <p className="mt-1 text-xs text-[#777d78]">
                解析結果と確定状況
              </p>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b bg-[#faf8f4] text-xs text-[#777d78]">
                <tr>
                  <th className="px-5 py-3">ファイル</th>
                  <th className="px-5 py-3">期間</th>
                  <th className="px-5 py-3">行数</th>
                  <th className="px-5 py-3">警告 / 除外</th>
                  <th className="px-5 py-3">状態</th>
                  <th className="px-5 py-3">作成</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.imports.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{batch.file_name}</p>
                      <p className="mt-1 font-mono text-[10px] text-[#858b86]">
                        {batch.file_hash.slice(0, 16)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs tabular">
                      {batch.period_from ?? "-"} 〜 {batch.period_to ?? "-"}
                    </td>
                    <td className="px-5 py-4 tabular">
                      {batch.accepted_rows}/{batch.total_rows}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <FileWarning className="h-4 w-4 text-[#b28a45]" />
                        {batch.warning_rows} / {batch.rejected_rows}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-5 py-4 text-xs text-[#777d78]">
                      {formatJstDateTime(batch.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/imports/${batch.id}`}
                        className="inline-flex items-center gap-1 font-bold text-[#b64f3b]"
                      >
                        詳細
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </>
  );
}
