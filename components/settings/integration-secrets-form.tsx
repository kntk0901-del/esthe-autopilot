"use client";

import { useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IntegrationSecretKey, SecretStatus } from "@/lib/types";

// X資格情報は店舗ごとに別アカウントへ投稿するため、ここ(全店共通)では扱わない。
// X4項目は「店舗別X投稿アカウント」セクションで店舗単位に設定する。
const fields: Array<[IntegrationSecretKey, string]> = [
  ["geminiApiKey", "Gemini API key"],
  ["upstashRedisUrl", "Upstash Redis URL"],
  ["upstashRedisToken", "Upstash Redis token"],
  ["qstashToken", "QStash token"],
  ["qstashCurrentSigningKey", "QStash current signing key"],
  ["qstashNextSigningKey", "QStash next signing key"],
];

export function IntegrationSecretsForm({
  initialStatus,
}: {
  initialStatus: SecretStatus;
}) {
  const [values, setValues] = useState<Partial<Record<IntegrationSecretKey, string>>>({});
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    const changed = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined),
    );
    setPending(true);
    const response = await fetch("/api/settings/secrets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secrets: changed }),
    });
    const result = (await response.json()) as {
      message?: string;
      secretStatus?: SecretStatus;
    };
    setPending(false);
    if (response.ok && result.secretStatus) {
      setStatus(result.secretStatus);
      setValues({});
      setMessage("保存しました。秘密値は再表示されません。");
    } else {
      setMessage(result.message ?? "保存に失敗しました");
    }
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map(([key, label]) => (
        <label key={key} className="text-xs font-semibold text-[#626862]">
          {label} {status[key] ? <span className="text-[#2f7d6d]">設定済み</span> : null}
          <input
            type="password"
            value={values[key] ?? ""}
            placeholder={status[key] ? "変更する場合のみ入力" : "未設定"}
            onChange={(event) =>
              setValues((current) => ({ ...current, [key]: event.target.value }))
            }
            className="mt-1.5 h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
          />
        </label>
      ))}
      <div className="flex items-end justify-between gap-3 md:col-span-2">
        <p className="text-xs text-[#777d78]">{message}</p>
        <Button onClick={save} disabled={pending || Object.keys(values).length === 0}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          秘密情報を保存
        </Button>
      </div>
    </div>
  );
}
