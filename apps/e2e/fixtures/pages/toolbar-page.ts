import { type Page, type Locator } from '@playwright/test';

/**
 * ツールバーのPage Object Model
 */
export class ToolbarPage {
  readonly page: Page;
  readonly toolbar: Locator;
  readonly toolButtons: {
    select: Locator;
    rectangle: Locator;
    ellipse: Locator;
    line: Locator;
    text: Locator;
  };
  readonly actionButtons: {
    undo: Locator;
    redo: Locator;
    clear: Locator;
    download: Locator;
  };

  constructor(page: Page) {
    this.page = page;
    this.toolbar = page.locator('.toolbar, [data-testid="toolbar"]');
    
    // Tool buttons
    this.toolButtons = {
      select: page.locator('[data-tool="select"]'),
      rectangle: page.locator('[data-tool="rectangle"]'),
      ellipse: page.locator('[data-tool="ellipse"]'),
      line: page.locator('[data-tool="line"]'),
      text: page.locator('[data-tool="text"]'),
    };
    
    // Action buttons
    this.actionButtons = {
      undo: page.locator('[data-action="undo"], button:has-text("Undo")'),
      redo: page.locator('[data-action="redo"], button:has-text("Redo")'),
      clear: page.locator('[data-action="clear"], button:has-text("Clear")'),
      download: page.locator('[data-action="download"], button:has-text("Download")'),
    };
  }

  /**
   * ツールを選択
   */
  async selectTool(tool: keyof typeof this.toolButtons) {
    await this.toolButtons[tool].click();
    // Wait for tool activation
    await this.page.waitForTimeout(100);
  }

  /**
   * 現在選択されているツールを取得
   */
  async getActiveTool(): Promise<string | null> {
    for (const [toolName, button] of Object.entries(this.toolButtons)) {
      const isActive = await button.getAttribute('data-active') === 'true' ||
                      await button.getAttribute('aria-pressed') === 'true' ||
                      (await button.getAttribute('class'))?.includes('active');
      if (isActive) {
        return toolName;
      }
    }
    return null;
  }

  /**
   * アンドゥ
   */
  async undo() {
    await this.actionButtons.undo.click();
  }

  /**
   * リドゥ
   */
  async redo() {
    await this.actionButtons.redo.click();
  }

  /**
   * キャンバスをクリア
   */
  async clearCanvas() {
    await this.actionButtons.clear.click();
    // Handle confirmation dialog if present
    const confirmButton = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmButton.isVisible({ timeout: 1000 })) {
      await confirmButton.click();
    }
  }

  /**
   * ダウンロード
   */
  async download() {
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await this.actionButtons.download.click();
    const download = await downloadPromise;
    return download;
  }

  /**
   * ツールが有効かチェック
   */
  async isToolEnabled(tool: keyof typeof this.toolButtons): Promise<boolean> {
    const button = this.toolButtons[tool];
    const isDisabled = await button.getAttribute('disabled') === 'true' ||
                      await button.getAttribute('aria-disabled') === 'true';
    return !isDisabled;
  }

  /**
   * アクションが有効かチェック
   */
  async isActionEnabled(action: keyof typeof this.actionButtons): Promise<boolean> {
    const button = this.actionButtons[action];
    const isDisabled = await button.getAttribute('disabled') === 'true' ||
                      await button.getAttribute('aria-disabled') === 'true';
    return !isDisabled;
  }

  /**
   * カラーピッカーから色を選択
   */
  async selectColor(color: string) {
    const colorPicker = this.page.locator('input[type="color"], [data-testid="color-picker"]');
    await colorPicker.fill(color);
  }

  /**
   * ストローク幅を設定
   */
  async setStrokeWidth(width: number) {
    const strokeInput = this.page.locator('input[type="range"][data-stroke], input[type="number"][data-stroke]');
    await strokeInput.fill(width.toString());
  }

  /**
   * 塗りつぶしの有効/無効を切り替え
   */
  async toggleFill() {
    const fillToggle = this.page.locator('input[type="checkbox"][data-fill], [data-testid="fill-toggle"]');
    await fillToggle.click();
  }

  /**
   * グリッドの表示/非表示を切り替え
   */
  async toggleGrid() {
    const gridToggle = this.page.locator('[data-action="toggle-grid"], button:has-text("Grid")');
    await gridToggle.click();
  }

  /**
   * スナップの有効/無効を切り替え
   */
  async toggleSnap() {
    const snapToggle = this.page.locator('[data-action="toggle-snap"], button:has-text("Snap")');
    await snapToggle.click();
  }

  /**
   * ツールバーが表示されているかチェック
   */
  async isVisible(): Promise<boolean> {
    return await this.toolbar.isVisible();
  }

  /**
   * ツールバーの位置を取得
   */
  async getPosition(): Promise<{ x: number; y: number } | null> {
    const box = await this.toolbar.boundingBox();
    if (!box) return null;
    return { x: box.x, y: box.y };
  }
}