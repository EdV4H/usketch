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
		// 新 UI の CTA は日本語
		await expect(page.getByRole("button", { name: "新規ローカルボード" })).toBeVisible();
	});

	test("local board can be created and opened", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);
		await expect(page.locator("[style*='touch-action: none']")).toBeVisible();
	});

	test("default board: select tool (vim off) and consolidated top bar visible", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);
		await expect(page.locator("[style*='touch-action: none']")).toBeVisible();
		// vim は既定 OFF（Control HUD から切替）なので status line は出ない。
		await expect(page.locator('[data-testid="vim-status-line"]')).not.toBeVisible();
		// 四隅に散っていた chrome は上部中央の単一バー(TopBar)に集約済み。
		await expect(page.locator('[data-testid="top-bar"]')).toBeVisible();
	});

	test("command palette opens with Cmd+K and closes with Esc", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);

		// ボードの準備完了をキャンバスで判定。
		await expect(page.locator("[style*='touch-action: none']")).toBeVisible();

		// Cmd+K / Ctrl+K（vim は修飾キー併用を素通しするのでパレットが開く）
		await page.keyboard.press("ControlOrMeta+k");

		const palette = page.locator('[role="dialog"][aria-label="コマンドパレット"]');
		await expect(palette).toBeVisible();

		// グループが出ている (複数の候補テキストが紛れ込むので最初の 1 件で特定)
		await expect(palette.getByText("アクション", { exact: true })).toBeVisible();
		await expect(palette.getByText("テーマ", { exact: true })).toBeVisible();

		// Esc で閉じる
		await page.keyboard.press("Escape");
		await expect(palette).not.toBeVisible();
	});

	test("command palette executes a theme command", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);
		await expect(page.locator("[style*='touch-action: none']")).toBeVisible();

		await page.keyboard.press("ControlOrMeta+k");

		const palette = page.locator('[role="dialog"][aria-label="コマンドパレット"]');
		await expect(palette).toBeVisible();

		// 「テーマ切替: ライト」コマンドをクリックして実行
		await palette.locator("text=テーマ切替: ライト").click();

		// パレットが閉じ、data-theme が light に
		await expect(palette).not.toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	});
});
