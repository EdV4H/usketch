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
		await expect(page.getByTestId("canvas-container")).toBeVisible();
	});

	test("board: vim off by default; HUD discoverability hint visible", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);
		await expect(page.getByTestId("canvas-container")).toBeVisible();
		// vim は既定 OFF（Control HUD から切替）なので status line は出ない。
		await expect(page.locator('[data-testid="vim-status-line"]')).not.toBeVisible();
		// TopBar は撤去済み。常時 chrome の代わりに、bottom-center の HUD 導線ヒント
		// （`` ` `` で開く）が常に見えていることを確認する。
		await expect(page.getByText("Debug HUD", { exact: false })).toBeVisible();
	});

	test("Control HUD opens with backtick and shows the action search", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);

		// ボードの準備完了をキャンバスで判定。
		await expect(page.getByTestId("canvas-container")).toBeVisible();

		// Control HUD は既定で閉じている。バッククォートで開く
		// （コマンドパレットは廃止し、アクション検索は Control HUD に一本化）。
		await page.keyboard.press("`");

		const search = page.getByPlaceholder("アクションを検索…");
		await expect(search).toBeVisible();
		// アプリ横断アクション（テーマ）が Controls に列挙されている
		await expect(page.getByText("テーマ切替: ライト", { exact: true })).toBeVisible();

		// バッククォートで閉じる
		await page.keyboard.press("`");
		await expect(search).not.toBeVisible();
	});

	test("Control HUD action search executes a theme action", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "新規ローカルボード" }).click();
		await page.waitForURL(/\/local\//);
		await expect(page.getByTestId("canvas-container")).toBeVisible();

		await page.keyboard.press("`");

		const search = page.getByPlaceholder("アクションを検索…");
		await expect(search).toBeVisible();

		// 検索で絞り込み → アクションを発火
		await search.fill("テーマ切替: ライト");
		await page.getByRole("button", { name: "テーマ切替: ライト" }).click();

		// data-theme が light に
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	});
});
