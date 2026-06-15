"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Copy, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildExtractionPrompt } from "@/lib/import/extraction-prompt";

export function AiImport() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sourceLabel, setSourceLabel] = useState("AI抽出");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceLabel(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const parts: string[] = [];
      for (const name of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
          header: 1,
          blankrows: false,
          defval: null,
        }) as unknown[][];
        parts.push(`# シート: ${name}`);
        rows.slice(0, 400).forEach((row) => parts.push(JSON.stringify(row)));
      }
      setContent(parts.join("\n"));
      setMessage(`「${file.name}」を読み込みました。プロンプトを生成してください。`);
    } catch {
      setMessage("ファイルを読み込めませんでした(xlsx/xls/csv に対応)");
    }
    event.target.value = "";
  }

  function generate() {
    if (!content.trim()) {
      setMessage("ファイルを選ぶか、テキストを貼り付けてください");
      return;
    }
    setPrompt(buildExtractionPrompt(content.trim(), new Date().getFullYear()));
    setMessage(
      "プロンプトを生成しました。コピーしてChatGPT/Claude等に貼り付け、出力されたJSONを下の欄に貼り戻してください。",
    );
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("プロンプトをコピーしました");
    } catch {
      setMessage("自動コピーに失敗しました。欄内を手動で選択してコピーしてください");
    }
  }

  async function importResult() {
    setPending(true);
    setMessage(null);
    let records: unknown;
    try {
      const text = result
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "");
      records = JSON.parse(text);
    } catch {
      setMessage("JSONとして解釈できません。AIが出力した配列をそのまま貼り付けてください");
      setPending(false);
      return;
    }
    if (!Array.isArray(records)) {
      setMessage("JSON配列([ で始まる)を貼り付けてください");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/imports/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ records, sourceLabel }),
      });
      const data = (await response.json()) as {
        batchId?: string;
        message?: string;
      };
      if (!response.ok || !data.batchId) {
        throw new Error(data.message ?? "取込に失敗しました");
      }
      router.push(`/imports/${data.batchId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取込に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-[#777d78]">
          STEP 1: 取り込む内容
        </p>
        <p className="mt-1 text-xs text-[#858b86]">
          フォーマットが一定でない売上表(Excel/CSV)を選ぶか、議事録・LINE報告などのテキストを貼り付けてください。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="text-xs"
          />
        </div>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="ここに議事録・LINE報告・売上メモ等を貼り付け(またはファイルを選択)"
          className="mt-2 h-28 w-full rounded-lg border bg-white p-3 text-xs"
        />
      </div>

      <div>
        <Button type="button" variant="secondary" onClick={generate}>
          <Sparkles className="h-4 w-4" /> プロンプトを生成
        </Button>
      </div>

      {prompt ? (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#777d78]">
              STEP 2: このプロンプトをコピー → ChatGPT/Claude に貼り付け
            </p>
            <button
              type="button"
              onClick={copyPrompt}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b64f3b] hover:underline"
            >
              <Copy className="h-3.5 w-3.5" /> コピー
            </button>
          </div>
          <textarea
            readOnly
            value={prompt}
            className="mt-2 h-40 w-full rounded-lg border bg-[#faf8f4] p-3 text-[11px] leading-5"
          />
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold text-[#777d78]">
          STEP 3: AIが出力したJSONを貼り戻して取込
        </p>
        <textarea
          value={result}
          onChange={(event) => setResult(event.target.value)}
          placeholder='[ { "date": "2026-02-03", "store": "大井町", "therapist": "ゆかり", "sales": 14000, ... } ]'
          className="mt-2 h-32 w-full rounded-lg border bg-white p-3 text-xs"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button type="button" disabled={pending || !result.trim()} onClick={importResult}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {pending ? "取込中" : "取り込む(レビューへ)"}
          </Button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border bg-[#f6f3ed] p-3 text-xs leading-5 text-[#626862]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
