"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ImageIcon, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countCharacters } from "@/lib/posting/post-validator";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const MAX_CHARS = 280;

// 本文をXの表示に近づけてレンダリングする(改行保持・URLを青字に)。
// split後のチャンク判定はlastIndexの影響を避けるため非グローバルな正規表現で行う。
function renderBody(text: string) {
  return text.split(URL_PATTERN).map((chunk, index) =>
    /^https?:\/\//.test(chunk) ? (
      <span key={index} className="text-[#1d9bf0]">
        {chunk}
      </span>
    ) : (
      <span key={index}>{chunk}</span>
    ),
  );
}

export function PostEditor({
  postId,
  initialText,
  disabled,
  accountName,
  displayName,
  imageUrls = [],
}: {
  postId: string;
  initialText: string;
  disabled: boolean;
  accountName?: string | null;
  displayName?: string;
  imageUrls?: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const weighted = useMemo(() => countCharacters(text), [text]);
  const emojiCount = useMemo(
    () => text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0,
    [text],
  );
  const hashtagCount = useMemo(
    () => text.match(/#[^\s#]+/g)?.length ?? 0,
    [text],
  );
  const over = weighted > MAX_CHARS;
  const near = !over && weighted > MAX_CHARS - 20;
  const meterColor = over
    ? "#b34839"
    : near
      ? "#b07d2f"
      : "#2f7d6d";

  const handle = accountName ? `@${accountName}` : "@your_store";
  const avatarChar = (displayName ?? accountName ?? "S").slice(0, 1);

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
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        rows={9}
        className="w-full resize-none rounded-xl border bg-white p-4 text-sm leading-7 disabled:bg-[#f6f3ed]"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-[#777d78]">
          <span className="font-semibold" style={{ color: meterColor }}>
            {weighted} / {MAX_CHARS}
          </span>
          <span>絵文字 {emojiCount}</span>
          <span>ハッシュタグ {hashtagCount}</span>
        </div>
        <div className="flex items-center gap-3">
          {message ? (
            <span className="text-xs text-[#6e746f]">{message}</span>
          ) : null}
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

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ece8e0]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, (weighted / MAX_CHARS) * 100)}%`,
            backgroundColor: meterColor,
          }}
        />
      </div>
      {over ? (
        <p className="text-xs font-semibold text-[#b34839]">
          Xの文字数上限({MAX_CHARS})を超えています。日本語は1文字=2、URLは23として計算します。
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a9389]">
          Xでの見え方(プレビュー)
        </p>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ede9e1] font-serif font-bold text-[#435267]">
              {avatarChar}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm">
                <span className="font-bold text-[#0f1419]">
                  {displayName ?? "店舗アカウント"}
                </span>
                <span className="text-[#536471]">{handle}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-[#0f1419]">
                {renderBody(text)}
              </p>
              {imageUrls.length > 0 ? (
                <div
                  className={`mt-3 grid gap-1 overflow-hidden rounded-2xl border ${
                    imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}
                >
                  {imageUrls.slice(0, 4).map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="grid aspect-video place-items-center bg-[#f6f3ed] p-2 text-center"
                    >
                      <ImageIcon className="mb-1 h-5 w-5 text-[#9b9388]" />
                      <p className="line-clamp-1 break-all text-[10px] text-[#777d78]">
                        {safeHost(url)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
