"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PostEditor({
  postId,
  initialText,
  disabled,
}: {
  postId: string;
  initialText: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text_content: text }),
    });
    const result = (await response.json()) as { message?: string };
    setPending(false);
    setMessage(response.ok ? "保存しました" : result.message ?? "保存に失敗しました");
    if (response.ok) router.refresh();
  }
  return (
    <div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        rows={11}
        className="w-full resize-none rounded-xl border bg-white p-4 text-sm leading-7 disabled:bg-[#f6f3ed]"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-[#777d78]">{Array.from(text).length}文字</p>
        <div className="flex items-center gap-3">
          {message ? <span className="text-xs text-[#6e746f]">{message}</span> : null}
          <Button onClick={save} disabled={disabled || pending} size="sm">
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            本文を保存
          </Button>
        </div>
      </div>
    </div>
  );
}
