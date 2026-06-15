import { CheckCircle2, CircleDashed, Database, KeyRound, Radio, Sparkles } from "lucide-react";
import { StoreSettingsForm } from "@/components/settings/store-settings-form";
import { StoreXCredentialsForm } from "@/components/settings/store-x-credentials-form";
import { SystemSettingsForm } from "@/components/settings/system-settings-form";
import { IntegrationSecretsForm } from "@/components/settings/integration-secrets-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getEnv } from "@/lib/config/env";
import { getAppData } from "@/lib/db/repository";
import { getSecretStatus, getStoreScopedXStatus } from "@/lib/settings/secrets";

export default async function SettingsPage() {
  const data = await getAppData();
  const env = getEnv();
  const secretStatus = await getSecretStatus();
  const storeXStatus = await getStoreScopedXStatus(
    data.stores.map((store) => store.code),
  );
  const services = [
    {
      name: "Supabase",
      ready: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      icon: Database,
      detail: env.DATA_MODE === "mock" ? "Mock data mode" : "Database mode",
    },
    {
      name: "Upstash Redis",
      ready: secretStatus.upstashRedisUrl && secretStatus.upstashRedisToken,
      icon: Radio,
      detail: data.systemSettings.xMockMode ? "Mock lock active" : "Required for real posting",
    },
    {
      name: "QStash",
      ready:
        secretStatus.qstashToken &&
        secretStatus.qstashCurrentSigningKey &&
        secretStatus.qstashNextSigningKey,
      icon: Radio,
      detail:
        data.systemSettings.schedulerMode === "qstash"
          ? "店舗別の設定時刻で実行"
          : "Vercel日次Cronを使用",
    },
    {
      name: "Gemini",
      ready: data.systemSettings.useGemini && secretStatus.geminiApiKey,
      icon: Sparkles,
      detail: data.systemSettings.useGemini
        ? data.systemSettings.geminiModel
        : "Fixed template fallback",
    },
    {
      name: "X API",
      ready: secretStatus.xApiKey && secretStatus.xAccessToken,
      icon: KeyRound,
      detail: data.systemSettings.xMockMode ? "Mock posting" : "Official API mode",
    },
  ];
  // 本番稼働までの導入手順。上から順に設定していくと実運用に到達できる。
  const readiness = [
    {
      label: "永続DB・ログイン",
      ready: env.DATA_MODE === "supabase",
      detail: "Supabaseモード",
      hint: "Supabaseの接続情報を環境変数に設定し、DATA_MODEをsupabaseにします。",
    },
    {
      label: "秘密情報暗号化",
      ready: Boolean(env.SETTINGS_ENCRYPTION_KEY),
      detail: "SETTINGS_ENCRYPTION_KEY",
      hint: "資格情報を暗号化保存するための鍵(SETTINGS_ENCRYPTION_KEY)を設定します。",
    },
    {
      label: "排他制御",
      ready: secretStatus.upstashRedisUrl && secretStatus.upstashRedisToken,
      detail: "Upstash Redis",
      hint: "下の「外部API資格情報」にUpstash RedisのURLとTokenを入力します(重複投稿を防止)。",
    },
    {
      label: "実X投稿",
      ready:
        !data.systemSettings.xMockMode &&
        secretStatus.xApiKey &&
        secretStatus.xApiSecret &&
        secretStatus.xAccessToken &&
        secretStatus.xAccessTokenSecret,
      detail: "XモックOFF + 4資格情報",
      hint: "X APIの4資格情報を入力し、「分析・投稿ガード」でXモックをOFFにします。",
    },
    {
      label: "店舗設定",
      ready: data.stores
        .filter((store) => store.enabled && store.auto_scrape_enabled)
        .every((store) => Boolean(store.schedule_url)),
      detail: "自動取得対象のURL",
      hint: "下の「店舗設定」で、自動取得する店舗のスケジュールURLを登録します。",
    },
    {
      label: "自動実行",
      ready:
        data.systemSettings.schedulerMode === "vercel_daily"
          ? Boolean(env.CRON_SECRET)
          : secretStatus.qstashToken &&
            secretStatus.qstashCurrentSigningKey &&
            secretStatus.qstashNextSigningKey &&
            data.systemSettings.appBaseUrl.startsWith("https://"),
      detail:
        data.systemSettings.schedulerMode === "qstash"
          ? "QStash店舗別時刻"
          : "Vercel 09:00 JST",
      hint: "日次実行の方式を選びます。Vercel CronはCRON_SECRET、QStashは3つの鍵が必要です。",
    },
  ];
  const readyCount = readiness.filter((item) => item.ready).length;
  const nextStep = readiness.find((item) => !item.ready);
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="設定"
        description="店舗URL、Xアカウント、分析モード、投稿上限、外部API資格情報を管理します。"
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Card key={service.name}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ede9e1]">
                    <Icon className="h-5 w-5 text-[#435267]" />
                  </span>
                  <Badge tone={service.ready ? "success" : "neutral"}>
                    {service.ready ? "接続可能" : "未設定"}
                  </Badge>
                </div>
                <h2 className="mt-4 font-serif text-lg font-semibold">
                  {service.name}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#777d78]">
                  {service.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>
      <Card className="mt-6">
        <CardHeader>
          <div>
            <h2 className="font-serif text-lg font-semibold">
              本番稼働までの手順
            </h2>
            <p className="mt-1 text-xs text-[#777d78]">
              上から順に設定すると実運用に到達できます。すべて完了するまで実アカウントの自動投稿はONにしないでください。
            </p>
          </div>
          <Badge tone={readyCount === readiness.length ? "success" : "warning"}>
            {readyCount}/{readiness.length} 完了
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextStep ? (
            <div className="rounded-xl border border-[#e5c7a0] bg-[#fdf6ec] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b07d2f]">
                次にやること
              </p>
              <p className="mt-1 text-sm font-bold">{nextStep.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#6e746f]">
                {nextStep.hint}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#bfe0d4] bg-[#f0f8f4] p-4 text-sm font-semibold text-[#2f7d6d]">
              すべての項目が完了しています。実アカウントの自動投稿を開始できます。
            </div>
          )}
          <ol className="space-y-2">
            {readiness.map((item, index) => (
              <li
                key={item.label}
                className="flex items-start gap-3 rounded-xl border bg-[#faf8f4] p-4"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    item.ready
                      ? "bg-[#2f7d6d] text-white"
                      : "bg-[#e7e2d8] text-[#8b8276]"
                  }`}
                >
                  {item.ready ? "✓" : index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{item.label}</p>
                    <Badge tone={item.ready ? "success" : "warning"}>
                      {item.ready ? "準備完了" : "要設定"}
                    </Badge>
                    <span className="text-[11px] text-[#9a9389]">
                      {item.detail}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#6e746f]">
                    {item.hint}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <div>
            <h2 className="font-serif text-lg font-semibold">分析・投稿ガード</h2>
            <p className="mt-1 text-xs text-[#777d78]">
              既定は運用実現性のみ。売上比較にはランダムホールドアウトが必要です。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <SystemSettingsForm settings={data.systemSettings} />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <div>
            <h2 className="font-serif text-lg font-semibold">外部API資格情報</h2>
            <p className="mt-1 text-xs text-[#777d78]">
              暗号化して保存し、画面やAPIから平文を再表示しません。Supabase基盤キーは環境変数で管理します。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <IntegrationSecretsForm initialStatus={secretStatus} />
        </CardContent>
      </Card>
      <section className="mt-6">
        <div className="mb-3">
          <h2 className="font-serif text-xl font-semibold">
            店舗別X投稿アカウント
          </h2>
          <p className="mt-1 text-xs text-[#777d78]">
            店舗ごとに別のXアカウントへ投稿する場合に設定します。未入力の店舗は上の「外部API資格情報」の共通キーを使用します。
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.stores.map((store) => (
            <Card key={store.id}>
              <CardHeader>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9654f]">
                    {store.code}
                  </p>
                  <h3 className="mt-1 font-serif text-lg font-semibold">
                    {store.display_name}
                  </h3>
                  {store.x_account_name ? (
                    <p className="mt-1 text-xs text-[#777d78]">
                      @{store.x_account_name}
                    </p>
                  ) : null}
                </div>
                <Badge tone={storeXStatus[store.code] ? "success" : "neutral"}>
                  {storeXStatus[store.code] ? "店舗専用キー" : "共通キー使用"}
                </Badge>
              </CardHeader>
              <CardContent>
                <StoreXCredentialsForm
                  storeCode={store.code}
                  storeName={store.display_name}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <div className="mb-3">
          <h2 className="font-serif text-xl font-semibold">店舗設定</h2>
          <p className="mt-1 text-xs text-[#777d78]">
            URLや目標値をコードへ埋め込まず管理
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.stores.map((store) => (
            <Card key={store.id}>
              <CardHeader>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9654f]">
                    {store.code}
                  </p>
                  <h3 className="mt-1 font-serif text-lg font-semibold">
                    {store.display_name}
                  </h3>
                </div>
                {store.enabled ? (
                  <CheckCircle2 className="h-5 w-5 text-[#2f7d6d]" />
                ) : (
                  <CircleDashed className="h-5 w-5 text-[#777d78]" />
                )}
              </CardHeader>
              <CardContent>
                <StoreSettingsForm store={store} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-serif text-lg font-semibold">運用ルール</h2>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          <Rule title="Timezone" value="Asia/Tokyo" />
          <Rule title="保存時刻" value="UTC" />
          <Rule title="最大掲載人数" value="4名" />
          <Rule title="Cron" value="00:00 UTC / 09:00 JST" />
        </CardContent>
      </Card>
    </>
  );
}

function Rule({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-[#faf8f4] p-4">
      <p className="text-xs text-[#777d78]">{title}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
