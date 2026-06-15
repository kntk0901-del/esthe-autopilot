"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Store } from "@/lib/types";

export function GeneratePostControl({
  stores,
  date,
}: {
  stores: Store[];
  date: string;
}) {
  const router = useRouter();
  const [storeCode, setStoreCode] = useState(stores[0]?.code ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeCode, date, force: true }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "生成に失敗しました");
      setMessage("完了");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={storeCode}
          onChange={(event) => setStoreCode(event.target.value)}
          className="h-9 rounded-lg border bg-white px-3 text-sm"
        >
          {stores.map((store) => (
            <option key={store.code} value={store.code}>
              {store.display_name}
            </option>
          ))}
        </select>
        <Button type="button" disabled={pending || !storeCode} onClick={run}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {pending ? "生成中" : "投稿を生成"}
        </Button>
      </div>
      {message ? (
        <span className="max-w-56 text-[10px] leading-4 text-[#6e746f]">
          {message}
        </span>
      ) : null}
    </div>
  );
}
