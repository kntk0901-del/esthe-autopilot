"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Store, StoreScraperConfig } from "@/lib/types";

export function StoreSettingsForm({ store }: { store: Store }) {
  const [enabled, setEnabled] = useState(store.enabled);
  const [autoScrape, setAutoScrape] = useState(store.auto_scrape_enabled);
  const [autoPost, setAutoPost] = useState(store.auto_post_enabled);
  const [scheduleUrl, setScheduleUrl] = useState(store.schedule_url ?? "");
  const [bookingUrl, setBookingUrl] = useState(store.booking_url ?? "");
  const [xAccount, setXAccount] = useState(store.x_account_name ?? "");
  const [target, setTarget] = useState(String(store.monthly_target));
  const [postTime, setPostTime] = useState(store.posting_config.postTime);
  const [includeUrlRate, setIncludeUrlRate] = useState(
    String(Math.round(store.posting_config.includeUrlRate * 100)),
  );
  const [maxTherapists, setMaxTherapists] = useState(
    String(store.posting_config.maxTherapists),
  );
  const [hashtags, setHashtags] = useState(
    store.posting_config.hashtags.join("、"),
  );
  const [imageDomains, setImageDomains] = useState(
    store.posting_config.imageAllowedDomains.join("\n"),
  );
  const [approvalRequired, setApprovalRequired] = useState(
    store.posting_config.approvalRequired,
  );
  const [blockRestricted, setBlockRestricted] = useState(
    store.posting_config.blockWhenAccountRestricted,
  );
  const [health, setHealth] = useState(store.posting_config.accountHealthStatus);
  const [scraper, setScraper] = useState<StoreScraperConfig>(
    store.scraper_config,
  );
  const [pending, setPending] = useState<
    "save" | "health" | "scrape" | null
  >(null);
  const [message, setMessage] = useState("");

  function list(value: string): string[] {
    return value
      .split(/[\n,、]/)
      .map((item) => item.trim().replace(/^#/, ""))
      .filter(Boolean);
  }

  async function save() {
    setPending("save");
    setMessage("");
    const response = await fetch(`/api/stores/${store.code}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled,
        auto_scrape_enabled: autoScrape,
        auto_post_enabled: autoPost,
        schedule_url: scheduleUrl || null,
        booking_url: bookingUrl || null,
        x_account_name: xAccount || null,
        monthly_target: Number(target),
        scraper_config: scraper,
        posting_config: {
          ...store.posting_config,
          postTime,
          includeUrlRate: Math.min(1, Math.max(0, Number(includeUrlRate) / 100)),
          maxTherapists: Number(maxTherapists),
          approvalRequired,
          hashtags: list(hashtags),
          imageAllowedDomains: list(imageDomains),
          accountHealthStatus: health,
          blockWhenAccountRestricted: blockRestricted,
        },
      }),
    });
    const result = (await response.json()) as {
      message?: string;
      schedulerMessage?: string | null;
    };
    setPending(null);
    setMessage(
      response.ok
        ? result.schedulerMessage ?? "保存しました"
        : result.message ?? "保存に失敗しました",
    );
  }

  async function checkHealth() {
    setPending("health");
    setMessage("");
    const response = await fetch(`/api/stores/${store.code}/x-health`, {
      method: "POST",
    });
    const result = (await response.json()) as {
      status?: typeof health;
      impressions?: number | null;
      message?: string;
    };
    setPending(null);
    if (response.ok && result.status) {
      setHealth(result.status);
      setMessage(
        result.impressions === null
          ? "24時間経過した到達データがありません"
          : `直近到達 ${result.impressions} impressions`,
      );
    } else {
      setMessage(result.message ?? "到達確認に失敗しました");
    }
  }

  async function testScrape() {
    setPending("scrape");
    setMessage("");
    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
    }).format(new Date());
    const response = await fetch("/api/shifts/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeCode: store.code, date, forceLive: true }),
    });
    const result = (await response.json()) as {
      job?: {
        status: string;
        processed_count: number;
        success_count: number;
        error_count: number;
        error_message: string | null;
      };
      message?: string;
    };
    setPending(null);
    setMessage(
      response.ok && result.job
        ? `取得 ${result.job.processed_count}名 / 正常 ${result.job.success_count}名 / 要確認 ${result.job.error_count}名`
        : result.message ?? "取得テストに失敗しました",
    );
  }

  function setScraperField<K extends keyof StoreScraperConfig>(
    key: K,
    value: StoreScraperConfig[K],
  ) {
    setScraper((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-[#faf8f4] p-3">
        <Toggle label="店舗を運用対象にする" checked={enabled} onChange={setEnabled} />
        <Toggle
          label="出勤表を自動取得"
          checked={autoScrape}
          onChange={setAutoScrape}
          disabled={!enabled}
        />
        <Toggle
          label="Xへ自動投稿"
          checked={autoPost}
          onChange={setAutoPost}
          disabled={!enabled}
          emphasis
        />
        <p className="text-[10px] leading-5 text-[#777d78]">
          自動投稿OFFでも、出勤取得と投稿案の保存は継続します。
        </p>
      </div>

      <Field label="出勤表URL">
        <input
          type="url"
          value={scheduleUrl}
          onChange={(event) => setScheduleUrl(event.target.value)}
          className="input"
        />
      </Field>
      <Field label="予約先URL">
        <input
          type="url"
          value={bookingUrl}
          onChange={(event) => setBookingUrl(event.target.value)}
          className="input"
        />
      </Field>
      <Field label="投稿先Xアカウント">
        <input
          value={xAccount}
          onChange={(event) => setXAccount(event.target.value)}
          placeholder="@account"
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="自動実行時刻">
          <input
            type="time"
            value={postTime}
            onChange={(event) => setPostTime(event.target.value)}
            className="input"
          />
        </Field>
        <Field label="最大掲載人数">
          <input
            type="number"
            min={1}
            max={4}
            value={maxTherapists}
            onChange={(event) => setMaxTherapists(event.target.value)}
            className="input"
          />
        </Field>
        <Field label="予約URL掲載率（%）">
          <input
            type="number"
            min={0}
            max={100}
            value={includeUrlRate}
            onChange={(event) => setIncludeUrlRate(event.target.value)}
            className="input"
          />
        </Field>
        <Field label="月次売上目標">
          <input
            type="number"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field label="ハッシュタグ（読点区切り）">
        <input
          value={hashtags}
          onChange={(event) => setHashtags(event.target.value)}
          className="input"
        />
      </Field>
      <Field label="画像取得を許可するドメイン（1行1件）">
        <textarea
          value={imageDomains}
          onChange={(event) => setImageDomains(event.target.value)}
          rows={3}
          className="textarea"
        />
      </Field>

      <Toggle
        label="投稿前に管理者承認を必須にする"
        checked={approvalRequired}
        onChange={setApprovalRequired}
      />
      <Toggle
        label="X抑制・停止判定時は投稿しない"
        checked={blockRestricted}
        onChange={setBlockRestricted}
      />

      <Field label="Xアカウント状態">
        <select
          value={health}
          onChange={(event) => setHealth(event.target.value as typeof health)}
          className="input"
        >
          <option value="unknown">未確認</option>
          <option value="healthy">正常</option>
          <option value="limited">抑制の疑い</option>
          <option value="suspended">停止</option>
        </select>
      </Field>

      <details className="rounded-xl border bg-[#faf8f4] p-3">
        <summary className="cursor-pointer text-xs font-bold">
          高度なスクレイパー設定
        </summary>
        <div className="mt-3 grid gap-3">
          <SelectorField label="日付パネルselector" field="dateTabSelector" value={scraper.dateTabSelector} onChange={setScraperField} />
          <SelectorField label="日付パネルID形式" field="dateIdPattern" value={scraper.dateIdPattern} onChange={setScraperField} />
          <SelectorField label="出勤カードselector" field="cardSelector" value={scraper.cardSelector} onChange={setScraperField} />
          <SelectorField label="名前selector" field="nameSelector" value={scraper.nameSelector} onChange={setScraperField} />
          <SelectorField label="時間selector" field="timeSelector" value={scraper.timeSelector} onChange={setScraperField} />
          <SelectorField label="画像selector" field="imageSelector" value={scraper.imageSelector} onChange={setScraperField} />
          <SelectorField label="プロフィールリンクselector" field="profileLinkSelector" value={scraper.profileLinkSelector} onChange={setScraperField} />
          <SelectorField label="当日fallback selector" field="fallbackActiveTabSelector" value={scraper.fallbackActiveTabSelector} onChange={setScraperField} />
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[10px] text-[#777d78]">{message}</span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={testScrape}
            disabled={pending !== null}
          >
            {pending === "scrape" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            今すぐ取得テスト
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={checkHealth}
            disabled={pending !== null}
          >
            到達確認
          </Button>
          <Button size="sm" onClick={save} disabled={pending !== null}>
            {pending === "save" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
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

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  emphasis = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-bold ${
        checked && emphasis
          ? "border-[#2f7d6d] bg-[#e9f4f0] text-[#226255]"
          : "bg-white"
      } ${disabled ? "opacity-50" : ""}`}
    >
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#2f7d6d]"
      />
    </label>
  );
}

function SelectorField<K extends keyof StoreScraperConfig>({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: K;
  value: StoreScraperConfig[K];
  onChange: (field: K, value: StoreScraperConfig[K]) => void;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        className="input font-mono text-[11px]"
      />
    </Field>
  );
}
