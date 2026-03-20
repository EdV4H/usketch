import { expect, test } from "@playwright/test";

test.describe("Board", () => {
	test("dashboard loads", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("h1")).toContainText("uSketch");
	});

	test("login page loads", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator("h1")).toContainText("uSketch");
		await expect(page.locator('input[type="email"]')).toBeVisible();
	});

	test("local board can be created and opened", async ({ page }) => {
		await page.goto("/");
		await page.click("text=New Local Board");
		// ボードエディタが開かれることを確認
		await page.waitForURL(/\/local\//);
		// Canvasが表示されることを確認
		await expect(page.locator("[style*='touch-action: none']")).toBeVisible();
	});

	test("toolbar is visible on board page", async ({ page }) => {
		await page.goto("/");
		await page.click("text=New Local Board");
		await page.waitForURL(/\/local\//);
		// ツールバーが表示される
		await expect(page.locator("text=PNG")).toBeVisible();
		await expect(page.locator("text=SVG")).toBeVisible();
	});
});
