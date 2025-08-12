import type { Locator, Page } from "@playwright/test";

/**
 * ホワイトボードページのPage Object Model
 */
export class WhiteboardPage {
	readonly page: Page;
	readonly canvas: Locator;
	readonly selectionLayer: Locator;
	readonly contextMenu: Locator;

	constructor(page: Page) {
		this.page = page;
		// Update selectors to match current implementation
		this.canvas = page.locator("#canvas");
		this.selectionLayer = page.locator("#selection-layer");
		this.contextMenu = page.locator('[data-testid="context-menu"]');
	}

	/**
	 * ページに移動
	 */
	async goto(path = "/") {
		await this.page.goto(path);
	}

	/**
	 * ホワイトボードの準備完了を待つ
	 */
	async waitForReady() {
		await this.canvas.waitFor({ state: "visible" });
		await this.page.waitForLoadState("networkidle");
		// Canvasの初期化を待つ
		await this.page.waitForTimeout(500);
	}

	/**
	 * 図形を描画
	 */
	async drawShape(
		_shapeType: "rectangle" | "circle" | "line",
		startX: number,
		startY: number,
		endX: number,
		endY: number,
	) {
		await this.canvas.hover({ position: { x: startX, y: startY } });
		await this.page.mouse.down();
		await this.canvas.hover({ position: { x: endX, y: endY } });
		await this.page.mouse.up();
	}

	/**
	 * クリック操作
	 */
	async click(x: number, y: number) {
		await this.canvas.click({ position: { x, y } });
	}

	/**
	 * ダブルクリック操作
	 */
	async doubleClick(x: number, y: number) {
		await this.canvas.dblclick({ position: { x, y } });
	}

	/**
	 * 右クリック操作
	 */
	async rightClick(x: number, y: number) {
		await this.canvas.click({ button: "right", position: { x, y } });
	}

	/**
	 * 図形を選択
	 */
	async selectShape(shapeIndex: number = 0) {
		const shape = this.page.locator('[data-shape="true"]').nth(shapeIndex);
		await shape.click();
	}

	/**
	 * 複数の図形を選択（範囲選択）
	 */
	async selectMultipleShapes(startX: number, startY: number, endX: number, endY: number) {
		// Area selection by dragging
		await this.canvas.hover({ position: { x: startX, y: startY } });
		await this.page.mouse.down();
		await this.canvas.hover({ position: { x: endX, y: endY } });
		await this.page.mouse.up();
	}

	/**
	 * 図形を移動
	 */
	async moveShape(shapeIndex: number, deltaX: number, deltaY: number) {
		const shape = this.page.locator('[data-shape="true"]').nth(shapeIndex);
		const box = await shape.boundingBox();
		if (!box) throw new Error(`Shape at index ${shapeIndex} not found`);

		await shape.hover({ position: { x: box.width / 2, y: box.height / 2 } });
		await this.page.mouse.down();
		await this.page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2 + deltaY);
		await this.page.mouse.up();
	}

	/**
	 * 図形をリサイズ
	 */
	async resizeShape(
		shapeIndex: number,
		handle: "nw" | "ne" | "sw" | "se",
		deltaX: number,
		deltaY: number,
	) {
		// First select the shape
		await this.selectShape(shapeIndex);

		// Find resize handle
		const handleLocator = this.selectionLayer.locator(`[data-resize-handle="${handle}"]`);
		const box = await handleLocator.boundingBox();
		if (!box) throw new Error(`Resize handle ${handle} not found`);

		await handleLocator.hover();
		await this.page.mouse.down();
		await this.page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2 + deltaY);
		await this.page.mouse.up();
	}

	/**
	 * 削除操作
	 */
	async deleteSelected() {
		await this.page.keyboard.press("Delete");
	}

	/**
	 * アンドゥ操作
	 */
	async undo() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+z" : "Control+z");
	}

	/**
	 * リドゥ操作
	 */
	async redo() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+Shift+z" : "Control+Shift+z");
	}

	/**
	 * コピー操作
	 */
	async copy() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+c" : "Control+c");
	}

	/**
	 * ペースト操作
	 */
	async paste() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+v" : "Control+v");
	}

	/**
	 * カット操作
	 */
	async cut() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+x" : "Control+x");
	}

	/**
	 * 全選択
	 */
	async selectAll() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+a" : "Control+a");
	}

	/**
	 * ズームイン
	 */
	async zoomIn() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+Plus" : "Control+Plus");
	}

	/**
	 * ズームアウト
	 */
	async zoomOut() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+Minus" : "Control+Minus");
	}

	/**
	 * ズームリセット
	 */
	async zoomReset() {
		const isMac = process.platform === "darwin";
		await this.page.keyboard.press(isMac ? "Meta+0" : "Control+0");
	}

	/**
	 * パン操作
	 */
	async pan(deltaX: number, deltaY: number) {
		const canvasBox = await this.canvas.boundingBox();
		if (!canvasBox) throw new Error("Canvas not found");

		const centerX = canvasBox.x + canvasBox.width / 2;
		const centerY = canvasBox.y + canvasBox.height / 2;

		await this.page.keyboard.down("Space");
		await this.page.mouse.move(centerX, centerY);
		await this.page.mouse.down();
		await this.page.mouse.move(centerX + deltaX, centerY + deltaY);
		await this.page.mouse.up();
		await this.page.keyboard.up("Space");
	}

	/**
	 * 図形の数を取得
	 */
	async getShapeCount(_shapeType?: string): Promise<number> {
		// Current implementation uses data-shape attribute
		const selector = '[data-shape="true"]';
		return await this.page.locator(selector).count();
	}

	/**
	 * 選択されている図形の数を取得
	 */
	async getSelectedShapeCount(): Promise<number> {
		// Selection is indicated by selection handles visibility
		const handles = await this.selectionLayer.locator("[data-resize-handle]").count();
		return handles > 0 ? 1 : 0; // Current implementation supports single selection
	}

	/**
	 * コンテキストメニューを開く
	 */
	async openContextMenu(x: number, y: number) {
		await this.rightClick(x, y);
		await this.contextMenu.waitFor({ state: "visible" });
	}

	/**
	 * コンテキストメニューから項目を選択
	 */
	async selectContextMenuItem(itemText: string) {
		await this.contextMenu.locator(`text="${itemText}"`).click();
	}

	/**
	 * Get canvas dimensions
	 */
	async getCanvasDimensions(): Promise<{ width: number; height: number }> {
		const box = await this.canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");
		return { width: box.width, height: box.height };
	}

	/**
	 * Wait for shape animation to complete
	 */
	async waitForAnimation(duration = 300) {
		await this.page.waitForTimeout(duration);
	}

	/**
	 * Check if a point is inside a shape
	 */
	async isPointInsideShape(x: number, y: number, shapeIndex: number = 0): Promise<boolean> {
		const shape = this.page.locator('[data-shape="true"]').nth(shapeIndex);
		const box = await shape.boundingBox();
		if (!box) return false;

		return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
	}
}
