"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ActionButton({
  endpoint,
  body,
  label,
  pendingLabel = "処理中",
  variant,
  size,
  method = "POST",
  onDone,
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  method?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "処理に失敗しました");
      setMessage("完了");
      router.refresh();
      onDone?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました");
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={run}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {pending ? pendingLabel : label}
      </Button>
      {message ? (
        <span className="max-w-48 text-[10px] leading-4 text-[#6e746f]">
          {message}
        </span>
      ) : null}
    </span>
  );
}
