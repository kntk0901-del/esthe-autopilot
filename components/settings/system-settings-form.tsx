"use client";

import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SystemSettings } from "@/lib/types";

export function SystemSettingsForm({
  settings,
}: {
  settings: SystemSettings;
}) {
  const [form, setForm] = useState(settings);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function persist(): Promise<boolean> {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(result.message ?? "保存に失敗しました");
      return false;
    }
    return true;
  }
  async function save() {
    setPending(true);
    setMessage("");
    const saved = await persist();
    setPending(false);
    if (saved) setMessage("保存しました");
  }
  async function syncScheduler() {
    setPending(true);
    setMessage("");
    if (!(await persist())) {
      setPending(false);
      return;
    }
    const response = await fetch("/api/settings/scheduler", { method: "POST" });
    const result = (await response.json()) as {
      message?: string;
      result?: { schedules: Array<{ action: string }> };
    };
    setPending(false);
    setMessage(
      response.ok
        ? `${result.result?.schedules.filter((item) => item.action === "created").length ?? 0}店舗の自動実行時刻を同期しました`
        : result.message ?? "スケジュール同期に失敗しました",
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="評価モード">
        <select
          value={form.measurementMode}
          onChange={(event) =>
            set(
              "measurementMode",
              event.target.value as SystemSettings["measurementMode"],
            )
          }
          className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
        >
          <option value="operations_only">運用実現性のみ</option>
          <option value="randomized_holdout">ランダムホールドアウト</option>
        </select>
      </Field>
      <Field label="クラウドスケジューラー">
        <select
          value={form.schedulerMode}
          onChange={(event) =>
            set(
              "schedulerMode",
              event.target.value as SystemSettings["schedulerMode"],
            )
          }
          className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
        >
          <option value="vercel_daily">Vercel日次（09:00 JST）</option>
          <option value="qstash">QStash（店舗別設定時刻）</option>
        </select>
      </Field>
      <Field label="公開アプリURL">
        <input
          type="url"
          value={form.appBaseUrl}
          onChange={(event) => set("appBaseUrl", event.target.value)}
          className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
        />
      </Field>
      <NumberField
        label="1日投稿上限"
        value={form.dailyPostLimit}
        onChange={(value) => set("dailyPostLimit", value)}
      />
      <NumberField
        label="X月次予算上限（円）"
        value={form.monthlyXBudgetYen}
        onChange={(value) => set("monthlyXBudgetYen", value)}
      />
      <NumberField
        label="1投稿の想定X費用（円）"
        value={form.estimatedXCostPerPostYen}
        onChange={(value) => set("estimatedXCostPerPostYen", value)}
      />
      <Field label="Gemini model">
        <input
          value={form.geminiModel}
          onChange={(event) => set("geminiModel", event.target.value)}
          className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
        />
      </Field>
      <NumberField
        label="概算セラピスト取り分率"
        value={form.defaultTherapistPaymentRate}
        step={0.01}
        onChange={(value) => set("defaultTherapistPaymentRate", value)}
      />
      <Toggle
        label="全店舗のX投稿を許可（緊急停止）"
        checked={form.postingEnabled}
        onChange={(value) => set("postingEnabled", value)}
      />
      <Toggle
        label="X APIモックモード"
        checked={form.xMockMode}
        onChange={(value) => set("xMockMode", value)}
      />
      <Toggle
        label="Geminiを使用"
        checked={form.useGemini}
        onChange={(value) => set("useGemini", value)}
      />
      <Toggle
        label="botクリック除外"
        checked={form.botFilterEnabled}
        onChange={(value) => set("botFilterEnabled", value)}
      />
      <Toggle
        label="リーチ監視"
        checked={form.reachMonitoringEnabled}
        onChange={(value) => set("reachMonitoringEnabled", value)}
      />
      <Toggle
        label="粗利を概算として表示"
        checked={form.grossProfitIsEstimate}
        onChange={(value) => set("grossProfitIsEstimate", value)}
      />
      <NumberField
        label="24時間後の最低impressions"
        value={form.minimumImpressionsAfter24h}
        onChange={(value) => set("minimumImpressionsAfter24h", value)}
      />
      <Field label="X API base URL">
        <input
          type="url"
          value={form.xApiBaseUrl}
          onChange={(event) => set("xApiBaseUrl", event.target.value)}
          className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
        />
      </Field>
      <Field label="X media upload URL">
        <input
          type="url"
          value={form.xUploadBaseUrl}
          onChange={(event) => set("xUploadBaseUrl", event.target.value)}
          className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
        />
      </Field>
      <label className="block text-xs font-semibold text-[#626862] md:col-span-2 xl:col-span-3">
        bot判定User-Agent（1行1件）
        <textarea
          value={form.botUserAgentPatterns.join("\n")}
          onChange={(event) =>
            set(
              "botUserAgentPatterns",
              event.target.value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          rows={4}
          className="mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal"
        />
      </label>
      <div className="flex items-end justify-between gap-3 md:col-span-2 xl:col-span-3">
        <p className="text-xs text-[#777d78]">{message}</p>
        <div className="flex gap-2">
        <Button variant="secondary" onClick={syncScheduler} disabled={pending}>
          自動実行時刻を同期
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          システム設定を保存
        </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-[#626862]">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full rounded-lg border bg-white px-3 text-sm font-normal"
      />
    </Field>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border bg-[#faf8f4] p-3 text-sm font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
