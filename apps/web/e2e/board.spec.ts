import { expect, test } from "@playwright/test";

test.describe("Board", () => {
	test("community page loads", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("text=uSketch World")).toBeVisible();
	});

	test("login page loads", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator("h1")).toContainText("uSketch");
		await expect(page.locator("text=Continue with GitHub")).toBeVisible();
	});

	test("dashboard loads with local board button", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page.locator("h1")).toContainText("uSketch");
		await expect(page.locator("text=New Local Board")).toBeVisible();
	});

	test("local board can be created and opened", async ({ page }) => {
		await page.goto("/dashboard");
		await page.click("text=New Local Board");
		await page.waitForURL(/\/local\//);
		await expect(page.locator("[style*='touch-action: none']")).toBeVisible();
	});

	test("toolbar and export button visible on board page", async ({ page }) => {
		await page.goto("/dashboard");
		await page.click("text=New Local Board");
		await page.waitForURL(/\/local\//);
		// 新レイアウト: Toolbar は画面下中央の data-testid="toolbar" で特定
		await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
		// Undo ボタン（aria-label）
		await expect(page.locator('button[aria-label="元に戻す"]')).toBeVisible();
		// エクスポートボタン（aria-label）
		await expect(page.locator('button[aria-label="エクスポート"]')).toBeVisible();
	});
});
