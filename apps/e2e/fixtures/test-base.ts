import { test as base, type Page } from '@playwright/test';
import { WhiteboardPage } from './pages/whiteboard-page';
import { ToolbarPage } from './pages/toolbar-page';

/**
 * テストフィクスチャの型定義
 */
type TestFixtures = {
  whiteboardPage: WhiteboardPage;
  toolbarPage: ToolbarPage;
  testData: TestData;
};

/**
 * ワーカーフィクスチャの型定義
 */
type WorkerFixtures = {
  // ワーカースコープで共有されるフィクスチャ
  apiEndpoint: string;
};

/**
 * テストデータの型
 */
interface TestData {
  shapes: {
    rectangle: { width: number; height: number };
    circle: { radius: number };
    line: { length: number };
  };
  colors: string[];
  testUser: {
    id: string;
    name: string;
  };
}

/**
 * カスタムテストインスタンス
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ページオブジェクトのフィクスチャ
  whiteboardPage: async ({ page }, use) => {
    const whiteboardPage = new WhiteboardPage(page);
    await whiteboardPage.goto();
    await whiteboardPage.waitForReady();
    await use(whiteboardPage);
  },

  toolbarPage: async ({ page }, use) => {
    const toolbarPage = new ToolbarPage(page);
    await use(toolbarPage);
  },

  // テストデータのフィクスチャ
  testData: async ({}, use) => {
    const data: TestData = {
      shapes: {
        rectangle: { width: 100, height: 50 },
        circle: { radius: 30 },
        line: { length: 150 },
      },
      colors: ['#FF0000', '#00FF00', '#0000FF'],
      testUser: {
        id: 'test-user-1',
        name: 'Test User',
      },
    };
    await use(data);
  },

  // ワーカーレベルのフィクスチャ
  apiEndpoint: [async ({}, use) => {
    const endpoint = process.env.API_ENDPOINT || 'http://localhost:3000';
    await use(endpoint);
  }, { scope: 'worker' }],

  // ストレージステートのリセット
  storageState: async ({}, use) => {
    await use(undefined);
  },

  // ページの追加設定
  page: async ({ page }, use) => {
    // エラーハンドリング
    page.on('pageerror', (error) => {
      console.error(`Page error: ${error.message}`);
    });

    // コンソールログの収集（デバッグ用）
    if (process.env.DEBUG) {
      page.on('console', (msg) => {
        console.log(`Console ${msg.type()}: ${msg.text()}`);
      });
    }

    // ネットワークエラーの監視
    page.on('requestfailed', (request) => {
      console.error(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * カスタムアサーション
 */
export const customExpect = {
  /**
   * 要素が表示されていることを確認（アニメーション待機付き）
   */
  async toBeVisibleWithAnimation(locator: ReturnType<Page['locator']>) {
    await expect(locator).toBeVisible();
    await locator.waitFor({ state: 'visible' });
    // アニメーション完了を待つ
    await locator.page().waitForTimeout(300);
  },

  /**
   * Canvas上に図形が存在することを確認
   */
  async toHaveShapeOnCanvas(page: Page, shapeType: string, count = 1) {
    const shapes = await page.locator(`[data-shape-type="${shapeType}"]`).count();
    expect(shapes).toBe(count);
  },
};