"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const FIELDS = [
  { base: "xApiKey", label: "X API key" },
  { base: "xApiSecret", label: "X API secret" },
  { base: "xAccessToken", label: "X access token" },
  { base: "xAccessTokenSecret", label: "X access token secret" },
] as const;

export function StoreXCredentialsForm({
  storeCode,
  storeName,
}: {
  storeCode: string;
  storeName: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMessage(null);
    const secrets: Record<string, string> = {};
    for (const field of FIELDS) {
      const value = values[field.base]?.trim();
      if (value) secrets[`${field.base}:${storeCode}`] = value;
    }
    if (Object.keys(secrets).length === 0) {
      setMessage("入力がありません");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/settings/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secrets }),
      });
      if (!response.ok) throw new Error();
      setMessage("保存しました(この店舗はこのXアカウントに投稿されます)");
      setValues({});
      router.refresh();
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-[#6e746f]">
        この店舗だけ別のXアカウントに投稿する場合に設定します。空欄の項目は全店共通の資格情報を使用します。値は暗号化保存され再表示されません。
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.base} className="block text-xs font-semibold">
            {field.label}
            <input
              type="password"
              autoComplete="off"
              value={values[field.base] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.base]: event.target.value,
                }))
              }
              placeholder="変更する場合のみ入力"
              className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {pending ? "保存中" : `${storeName}のX資格情報を保存`}
        </Button>
        {message ? (
          <span className="text-[11px] text-[#6e746f]">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
