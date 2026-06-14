"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileSpreadsheet, LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Store } from "@/lib/types";

export function ImportUploader({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [storeId, setStoreId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    if (!file) return;
    setPending(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("storeId", storeId);
      form.append("targetYear", String(new Date().getFullYear()));
      const response = await fetch("/api/imports/upload", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        batch?: { id: string };
        message?: string;
      };
      if (!response.ok || !result.batch) {
        throw new Error(result.message ?? "アップロードに失敗しました");
      }
      router.push(`/imports/${result.batch.id}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "アップロードに失敗しました",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
      <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#b8b1a6] bg-[#faf8f4] px-5 text-center hover:border-[#d9654f]">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <FileSpreadsheet className="mb-3 h-9 w-9 text-[#2f7d6d]" />
        ) : (
          <UploadCloud className="mb-3 h-9 w-9 text-[#d9654f]" />
        )}
        <p className="font-semibold">
          {file ? file.name : "CSV / Excelを選択"}
        </p>
        <p className="mt-1 text-xs text-[#777d78]">
          .xlsx / .xls / .csv、最大5MB
        </p>
      </label>
      <div className="space-y-4">
        <label className="block text-sm font-semibold">
          対象店舗
          <select
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border bg-white px-3 font-normal"
          >
            <option value="">ファイルから判定</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.display_name}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-lg border bg-[#f6f3ed] p-3 text-xs leading-5 text-[#626862]">
          ヘッダ位置、合計行、別名、年なし日付を自動判定します。推定や不一致は確定前レビューへ送られます。
        </div>
        <Button onClick={upload} disabled={!file || pending} className="w-full">
          {pending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          解析してプレビュー
        </Button>
        {message ? <p className="text-xs text-[#b34839]">{message}</p> : null}
      </div>
    </div>
  );
}
