import { expect, test } from "@playwright/test";

test("dashboard and core pages are available in mock mode", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "全店ダッシュボード" })).toBeVisible();
  await expect(page.getByText("ザ・リッツ蒲田").first()).toBeVisible();

  await page.getByRole("link", { name: "投稿管理" }).click();
  await expect(page.getByRole("heading", { name: "投稿管理" })).toBeVisible();

  await page.getByRole("link", { name: "売上取込" }).click();
  await expect(page.getByRole("heading", { name: "売上取込" })).toBeVisible();

  await page.getByRole("link", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: "設定", exact: true })).toBeVisible();
  await expect(page.getByText("出勤表を自動取得").first()).toBeVisible();
  await expect(page.getByText("Xへ自動投稿").first()).toBeVisible();
});
