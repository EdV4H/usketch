import { expect, test } from "@playwright/test";

test.describe("Board", () => {
	test("the top opens the demo board", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("canvas-container")).toBeVisible();
	});

	test("an old region link goes to its page of the demo board", async ({ page }) => {
		await page.goto("/community/workshop");
		await page.waitForURL(/\/\?page=region-workshop$/);
		await page.goto("/community");
		await page.waitForURL((url) => url.pathname === "/" && url.search === "");
	});

	test("login page loads", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator("h1")).toContainText("uSketch");
		await expect(page.locator("text=Continue with GitHub")).toBeVisible();
	});

	test("try board opens a local board, and the same one again", async ({ page }) => {
		await page.goto("/try");
		await page.waitForURL(/\/local\//);
		await expect(page.getByTestId("canvas-container")).toBeVisible();
		const first = page.url();
		await page.goto("/try");
		await page.waitForURL(/\/local\//);
		expect(page.url()).toBe(first);
	});

	test("the removed board list redirects to the top", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForURL((url) => url.pathname === "/");
		await expect(page.getByTestId("canvas-container")).toBeVisible();
	});

	test("board: vim off by default; HUD discoverability hint visible", async ({ page }) => {
		await page.goto("/try");
		await page.waitForURL(/\/local\//);
		await expect(page.getByTestId("canvas-container")).toBeVisible();
		// vim は既定 OFF（Control HUD から切替）なので status line は出ない。
		await expect(page.locator('[data-testid="vim-status-line"]')).not.toBeVisible();
		// TopBar は撤去済み。常時 chrome の代わりに、bottom-center の HUD 導線ヒント
		// （`` ` `` で開く）が常に見えていることを確認する。
		await expect(page.getByText("Debug HUD", { exact: false })).toBeVisible();
	});

	test("Control HUD opens with backtick and shows the action search", async ({ page }) => {
		await page.goto("/try");
		await page.waitForURL(/\/local\//);

		// ボードの準備完了をキャンバスで判定。
		await expect(page.getByTestId("canvas-container")).toBeVisible();

		// Control HUD は既定で閉じている。バッククォートで開く
		// （コマンドパレットは廃止し、アクション検索は Control HUD に一本化）。
		await page.keyboard.press("`");

		const search = page.getByPlaceholder("プラグイン / 操作を検索…");
		await expect(search).toBeVisible();
		// プラグインのセクションは既定で畳まれているので、アクションはまだ見えない。
		const themeAction = page.getByText("テーマ切替: ライト", { exact: true });
		await expect(themeAction).not.toBeVisible();
		// 検索するとヒットしたセクションが自動展開され、アプリ横断アクション（テーマ）が出る。
		await search.fill("テーマ");
		await expect(themeAction).toBeVisible();

		// バッククォートで閉じる（入力欄にフォーカスがあると ` は文字入力になるので外す）
		await search.blur();
		await page.keyboard.press("`");
		await expect(search).not.toBeVisible();
	});

	test("Control HUD action search executes a theme action", async ({ page }) => {
		await page.goto("/try");
		await page.waitForURL(/\/local\//);
		await expect(page.getByTestId("canvas-container")).toBeVisible();

		await page.keyboard.press("`");

		const search = page.getByPlaceholder("プラグイン / 操作を検索…");
		await expect(search).toBeVisible();

		// 検索で絞り込み → アクションを発火
		await search.fill("テーマ切替: ライト");
		await page.getByRole("button", { name: "テーマ切替: ライト" }).click();

		// data-theme が light に
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	});
});
