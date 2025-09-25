import { expect, test } from "@playwright/test";

test.describe("Input System", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		// 入力デモを開く
		await page.click('button:has-text("Show Input Demo")');
		await page.waitForSelector(".input-demo");
	});

	test("入力デモUIが表示される", async ({ page }) => {
		// デモコンポーネントが表示されていることを確認
		await expect(page.locator(".input-demo")).toBeVisible();
		await expect(page.locator("h2:has-text('Input System Demo')")).toBeVisible();

		// コントロールが表示されていることを確認
		await expect(page.locator("select[value='default']").first()).toBeVisible();
		await expect(page.locator("input[type='checkbox']")).toBeVisible();

		// イベントログエリアが表示されていることを確認
		await expect(page.locator(".events-list")).toBeVisible();
	});

	test.describe("Keyboard Input", () => {
		test("ツール切り替えショートカットが動作する", async ({ page }) => {
			// Select tool (V key)
			await page.keyboard.press("v");
			await expect(page.locator(".event-item:has-text('Tool: Select')")).toBeVisible();

			// Rectangle tool (R key)
			await page.keyboard.press("r");
			await expect(page.locator(".event-item:has-text('Tool: Rectangle')")).toBeVisible();

			// Ellipse tool (E key)
			await page.keyboard.press("e");
			await expect(page.locator(".event-item:has-text('Tool: Ellipse')")).toBeVisible();

			// Free draw tool (P key)
			await page.keyboard.press("p");
			await expect(page.locator(".event-item:has-text('Tool: Free Draw')")).toBeVisible();
		});

		test("カメラ操作ショートカットが動作する", async ({ page }) => {
			const isMac = process.platform === "darwin";
			const modKey = isMac ? "Meta" : "Control";

			// Zoom in
			await page.keyboard.press(`${modKey}+=`);
			await expect(page.locator(".event-item:has-text('Camera: Zoom In')")).toBeVisible();

			// Zoom out
			await page.keyboard.press(`${modKey}+-`);
			await expect(page.locator(".event-item:has-text('Camera: Zoom Out')")).toBeVisible();

			// Reset camera
			await page.keyboard.press(`${modKey}+0`);
			await expect(page.locator(".event-item:has-text('Camera: Reset')")).toBeVisible();
		});

		test("編集ショートカットが動作する", async ({ page }) => {
			const isMac = process.platform === "darwin";
			const modKey = isMac ? "Meta" : "Control";

			// Undo
			await page.keyboard.press(`${modKey}+z`);
			await expect(page.locator(".event-item:has-text('Edit: Undo')")).toBeVisible();

			// Redo
			await page.keyboard.press(`${modKey}+Shift+z`);
			await expect(page.locator(".event-item:has-text('Edit: Redo')")).toBeVisible();

			// Delete
			await page.keyboard.press("Delete");
			await expect(page.locator(".event-item:has-text('Edit: Delete')")).toBeVisible();
		});

		test("Vimプリセットに切り替えて動作を確認", async ({ page }) => {
			// Vimプリセットに切り替え
			await page.selectOption('select:has-text("Keyboard Preset")', "vim");
			await page.waitForTimeout(100); // プリセット切り替えを待つ

			// Vimキーバインドをテスト（例: h, j, k, l でツール切り替え）
			// ここでは基本的なツール切り替えをテスト
			await page.keyboard.press("v");
			await expect(page.locator(".event-item:has-text('Tool: Select')")).toBeVisible();
		});
	});

	test.describe("Mouse Input", () => {
		test("マウスクリックイベントが記録される", async ({ page }) => {
			const canvas = page.locator(".input-demo");

			// 左クリック
			await canvas.click({ position: { x: 100, y: 100 } });
			await expect(page.locator(".event-item:has-text('Mouse: Select')")).toBeVisible();

			// 右クリック
			await canvas.click({ position: { x: 100, y: 100 }, button: "right" });
			await expect(page.locator(".event-item:has-text('Mouse: Context Menu')")).toBeVisible();
		});

		test("マウスホイールイベントが記録される", async ({ page }) => {
			const canvas = page.locator(".input-demo");

			// ホイールスクロール
			await canvas.hover();
			await page.mouse.wheel(0, 100);
			// Note: ホイールイベントの検証は、実装により異なる場合があるため、
			// 実際の動作に応じて調整が必要
		});

		test("マウスプリセットの切り替えが動作する", async ({ page }) => {
			// Trackpadプリセットに切り替え
			await page.selectOption("select:nth-of-type(2)", "trackpad");
			await page.waitForTimeout(100);

			// Gamingプリセットに切り替え
			await page.selectOption("select:nth-of-type(2)", "gaming");
			await page.waitForTimeout(100);

			// プリセット変更後もマウスイベントが動作することを確認
			const canvas = page.locator(".input-demo");
			await canvas.click({ position: { x: 100, y: 100 } });
			await expect(page.locator(".event-item:has-text('Mouse: Select')")).toBeVisible();
		});

		test("パン操作が動作する", async ({ page }) => {
			const canvas = page.locator(".input-demo");

			// Spaceキーを押しながらドラッグでパン操作
			await page.keyboard.down("Space");
			await canvas.hover({ position: { x: 100, y: 100 } });
			await page.mouse.down();
			await canvas.hover({ position: { x: 200, y: 200 } });
			await page.mouse.up();
			await page.keyboard.up("Space");

			// パンイベントが記録されていることを確認
			await expect(page.locator(".event-item:has-text('Pan:')").first()).toBeVisible();
		});
	});

	test.describe("Gesture Control", () => {
		test("ジェスチャーの有効/無効切り替えが動作する", async ({ page }) => {
			const checkbox = page.locator('input[type="checkbox"]');

			// 初期状態で有効になっていることを確認
			await expect(checkbox).toBeChecked();

			// ジェスチャーを無効にする
			await checkbox.uncheck();
			await expect(checkbox).not.toBeChecked();

			// ジェスチャーを再度有効にする
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		});

		// Note: タッチジェスチャーのE2Eテストは実装が複雑なため、
		// 実機やエミュレータでの手動テストが推奨される
		test("タッチジェスチャーのシミュレーション（基本確認）", async ({ page }) => {
			// Playwrightのタッチデバイスエミュレーション
			const canvas = page.locator(".input-demo");

			// ダブルタップのシミュレーション
			await canvas.tap({ position: { x: 100, y: 100 } });
			await page.waitForTimeout(50);
			await canvas.tap({ position: { x: 100, y: 100 } });

			// ダブルタップイベントが記録される可能性があることを確認
			// Note: 実際のタッチイベントの検証は環境依存
		});
	});

	test.describe("Event Log", () => {
		test("イベントログのクリアが動作する", async ({ page }) => {
			// いくつかのイベントを発生させる
			await page.keyboard.press("v");
			await page.keyboard.press("r");
			await page.keyboard.press("e");

			// イベントが記録されていることを確認
			const eventItems = page.locator(".event-item");
			await expect(eventItems).toHaveCount(3);

			// Clear Logボタンをクリック
			await page.click('button:has-text("Clear Log")');

			// イベントログがクリアされていることを確認
			await expect(page.locator(".empty-state")).toBeVisible();
			await expect(page.locator(".empty-state")).toHaveText("No events yet. Try some inputs!");
		});

		test("イベントログが最新20件を保持する", async ({ page }) => {
			// 25個のイベントを発生させる
			for (let i = 0; i < 25; i++) {
				await page.keyboard.press("v");
				await page.waitForTimeout(10);
			}

			// イベントログが20件に制限されていることを確認
			const eventItems = page.locator(".event-item");
			const count = await eventItems.count();
			expect(count).toBeLessThanOrEqual(20);
		});
	});

	test.describe("Integration", () => {
		test("キャンバスビューに戻ることができる", async ({ page }) => {
			// Show Canvasボタンをクリック
			await page.click('button:has-text("Show Canvas")');

			// キャンバスが表示されることを確認
			await expect(page.locator(".whiteboard-container")).toBeVisible();

			// 入力デモが非表示になることを確認
			await expect(page.locator(".input-demo")).not.toBeVisible();

			// 再度入力デモを表示できることを確認
			await page.click('button:has-text("Show Input Demo")');
			await expect(page.locator(".input-demo")).toBeVisible();
		});

		test("複数のプリセットとイベントを組み合わせて動作する", async ({ page }) => {
			// Vimプリセットに切り替え
			await page.selectOption('select:has-text("Keyboard Preset")', "vim");

			// Trackpadプリセットに切り替え
			await page.selectOption("select:nth-of-type(2)", "trackpad");

			// キーボードとマウスイベントを発生させる
			await page.keyboard.press("v");
			await page.locator(".input-demo").click({ position: { x: 100, y: 100 } });

			// 両方のイベントが記録されることを確認
			await expect(page.locator(".event-item:has-text('Tool: Select')")).toBeVisible();
			await expect(page.locator(".event-item:has-text('Mouse: Select')")).toBeVisible();

			// ジェスチャーを無効にしてもキーボードとマウスは動作する
			await page.locator('input[type="checkbox"]').uncheck();
			await page.keyboard.press("r");
			await expect(page.locator(".event-item:has-text('Tool: Rectangle')")).toBeVisible();
		});
	});
});
