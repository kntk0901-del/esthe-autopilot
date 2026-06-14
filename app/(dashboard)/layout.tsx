import { AppShell } from "@/components/layout/app-shell";
import { getEnv } from "@/lib/config/env";
import { getAppData } from "@/lib/db/repository";
import { getSecretStatus } from "@/lib/settings/secrets";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = getEnv();
  const data = await getAppData();
  const secrets = await getSecretStatus();
  const operationMode =
    env.DATA_MODE === "mock"
      ? "mock"
      : !data.systemSettings.xMockMode &&
          secrets.xApiKey &&
          secrets.xApiSecret &&
          secrets.xAccessToken &&
          secrets.xAccessTokenSecret
        ? "production"
        : "setup";
  return <AppShell operationMode={operationMode}>{children}</AppShell>;
}
