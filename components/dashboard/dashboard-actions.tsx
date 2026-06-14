"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardActions({ date }: { date: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sync" | "daily">("idle");
  const [message, setMessage] = useState("");

  async function syncAll() {
    setState("sync");
    setMessage("");
    try {
      for (const storeCode of ["kamata", "oimachi", "sugamo"]) {
        const response = await fetch("/api/shifts/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ storeCode, date }),
        });
        if (!response.ok) throw new Error(`${storeCode}の同期に失敗しました`);
      }
      setMessage("3店舗を同期しました");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同期に失敗しました");
    } finally {
      setState("idle");
    }
  }

  async function runDaily() {
    setState("daily");
    setMessage("");
    try {
      const response = await fetch("/api/cron/daily");
      if (!response.ok) throw new Error("日次処理に失敗しました");
      setMessage("日次フローを実行しました");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "実行に失敗しました");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div>
        <Button variant="secondary" onClick={syncAll} disabled={state !== "idle"}>
          {state === "sync" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          全店舗同期
        </Button>
        {message ? (
          <p className="mt-1 text-[10px] text-[#6e746f]">{message}</p>
        ) : null}
      </div>
      <Button onClick={runDaily} disabled={state !== "idle"}>
        {state === "daily" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        日次フロー実行
      </Button>
    </div>
  );
}
