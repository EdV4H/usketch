# E2Eテスト実装ガイドライン

## 🎯 目的

このガイドラインは、E2Eテストの仕様と実装の間で発生した差異から学んだ教訓をもとに、今後の開発で同様の問題を防ぐための指針を提供します。

## 📋 発見された主要な問題と対策

### 1. DOM構造の前提と実装の不一致

**問題点:**
- E2Eテストが想定していたDOM属性（`data-shape`, `data-selected`, `data-tool`など）が実装に存在しない
- セレクタの命名規則が統一されていない

**解決策:**
```typescript
// ❌ Bad: 実装を確認せずにセレクタを仮定
const shapes = page.locator('[data-shape]');

// ✅ Good: 実装と合わせたセレクタを使用
const shapes = page.locator('[data-shape-id]');
```

**ガイドライン:**
1. **データ属性の標準化**: プロジェクト全体で使用するデータ属性を事前に定義
2. **セレクタ定義ファイル**: 共通のセレクタを一元管理

```typescript
// selectors.ts
export const SELECTORS = {
  canvas: '#canvas',
  shape: '[data-shape-id]',
  shapeType: (type: string) => `[data-shape-type="${type}"]`,
  tool: (name: string) => `[data-tool="${name}"]`,
  selected: '[data-selected="true"]',
  resizeHandle: '.resize-handle',
  selectionBox: '.selection-box',
} as const;
```

### 2. 非同期処理とタイミングの問題

**問題点:**
- 初期化処理の完了を待たずにテストを実行
- DOM更新のタイミングを適切に待機していない

**解決策:**
```typescript
// ❌ Bad: 固定の待機時間
await page.waitForTimeout(300);

// ✅ Good: 明示的な条件待機
await page.waitForSelector('#canvas', { state: 'visible' });
await page.waitForFunction(() => {
  const shapes = document.querySelectorAll('[data-shape-id]');
  return shapes.length >= 2;
});
```

**ガイドライン:**
1. **明示的な待機条件**: `waitForSelector`, `waitForFunction`を使用
2. **状態の確認**: アクション前に必要な状態を確認
3. **リトライメカニズム**: 不安定な操作にはリトライを実装

### 3. テストの独立性

**問題点:**
- テスト間で状態が共有される
- 前のテストの影響を受ける

**解決策:**
```typescript
test.describe('Whiteboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 新しいセッションで開始
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // 状態をリセット
    await page.evaluate(() => {
      // ローカルストレージをクリア
      localStorage.clear();
      // アプリケーション状態をリセット
      window.resetWhiteboard?.();
    });
    
    // 初期化完了を待機
    await page.waitForSelector('#canvas', { state: 'visible' });
  });
  
  test.afterEach(async ({ page }) => {
    // スクリーンショットを保存（失敗時のデバッグ用）
    await page.screenshot({ 
      path: `screenshots/test-${Date.now()}.png`,
      fullPage: true 
    });
  });
});
```

### 4. イベントシミュレーションの正確性

**問題点:**
- 実際のユーザー操作と異なるイベントシーケンス
- ドラッグ操作が正しくシミュレートされない

**解決策:**
```typescript
// ❌ Bad: 単純なクリックイベント
await element.click();

// ✅ Good: 実際のユーザー操作をシミュレート
async function drawShape(page: Page, start: Point, end: Point) {
  const canvas = page.locator('#canvas');
  
  // マウスを開始位置に移動
  await page.mouse.move(start.x, start.y);
  
  // マウスダウン
  await page.mouse.down();
  
  // スムーズにドラッグ（中間点を経由）
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const x = start.x + (end.x - start.x) * (i / steps);
    const y = start.y + (end.y - start.y) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(10); // 小さな遅延
  }
  
  // マウスアップ
  await page.mouse.up();
}
```

## 🏗️ テスト設計の原則

### 1. Contract Testing（契約テスト）

実装とテストの間の「契約」を明確に定義：

```typescript
// contracts/shape.contract.ts
export interface ShapeContract {
  // DOM要素の契約
  element: {
    selector: '[data-shape-id]';
    attributes: {
      'data-shape-id': string;
      'data-shape-type': ShapeType;
      'data-selected'?: 'true' | 'false';
    };
    classes?: string[];
  };
  
  // 動作の契約
  behavior: {
    selectable: boolean;
    draggable: boolean;
    resizable: boolean;
  };
  
  // イベントの契約
  events: {
    onClick?: () => void;
    onDrag?: (delta: Point) => void;
    onResize?: (newSize: Size) => void;
  };
}
```

### 2. Page Object Model (POM)

テストコードの保守性を高めるためのパターン：

```typescript
// pages/whiteboard.page.ts
export class WhiteboardPage {
  constructor(private page: Page) {}
  
  // ナビゲーション
  async goto() {
    await this.page.goto('/');
    await this.waitForLoad();
  }
  
  async waitForLoad() {
    await this.page.waitForSelector('#canvas', { state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }
  
  // アクション
  async selectTool(toolName: string) {
    await this.page.click(`[data-tool="${toolName}"]`);
    await this.page.waitForSelector(`[data-tool="${toolName}"][data-active="true"]`);
  }
  
  async drawRectangle(start: Point, end: Point) {
    await this.selectTool('rectangle');
    await this.dragOnCanvas(start, end);
  }
  
  async selectShape(shapeId: string) {
    await this.page.click(`[data-shape-id="${shapeId}"]`);
    await this.page.waitForSelector('.selection-box', { state: 'visible' });
  }
  
  // アサーション
  async getShapeCount(): Promise<number> {
    return await this.page.locator('[data-shape-id]').count();
  }
  
  async isShapeSelected(shapeId: string): Promise<boolean> {
    const shape = this.page.locator(`[data-shape-id="${shapeId}"]`);
    const selected = await shape.getAttribute('data-selected');
    return selected === 'true';
  }
  
  // ヘルパー
  private async dragOnCanvas(start: Point, end: Point) {
    const canvas = this.page.locator('#canvas');
    await canvas.hover({ position: start });
    await this.page.mouse.down();
    await canvas.hover({ position: end });
    await this.page.mouse.up();
  }
}
```

### 3. テストデータの管理

```typescript
// fixtures/shapes.fixture.ts
export const TEST_SHAPES = {
  rectangle: {
    small: { width: 50, height: 50 },
    medium: { width: 100, height: 100 },
    large: { width: 200, height: 150 },
  },
  positions: {
    topLeft: { x: 50, y: 50 },
    center: { x: 400, y: 300 },
    bottomRight: { x: 750, y: 550 },
  },
} as const;

// fixtures/test-data.ts
export function generateTestShape(type: ShapeType, index: number) {
  return {
    id: `test-shape-${type}-${index}`,
    type,
    x: 100 * (index % 5),
    y: 100 * Math.floor(index / 5),
    width: 80,
    height: 80,
  };
}
```

## 📊 テスト品質の指標

### 1. カバレッジ目標

```yaml
# .github/workflows/test.yml
coverage:
  unit: 90%
  integration: 80%
  e2e: 70%
  
  thresholds:
    statements: 85
    branches: 80
    functions: 85
    lines: 85
```

### 2. テストの安定性

```typescript
// test-utils/stability.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, onRetry } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      
      onRetry?.(attempt, error as Error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Retry failed');
}
```

### 3. パフォーマンス監視

```typescript
// test-utils/performance.ts
export async function measurePerformance(
  page: Page,
  action: () => Promise<void>,
  metric: string
): Promise<PerformanceMetrics> {
  const startTime = Date.now();
  
  // パフォーマンス記録開始
  await page.evaluate(() => performance.mark('action-start'));
  
  // アクション実行
  await action();
  
  // パフォーマンス記録終了
  await page.evaluate(() => {
    performance.mark('action-end');
    performance.measure('action', 'action-start', 'action-end');
  });
  
  // メトリクス取得
  const metrics = await page.evaluate(() => {
    const measure = performance.getEntriesByName('action')[0];
    return {
      duration: measure.duration,
      startTime: measure.startTime,
    };
  });
  
  return {
    metric,
    duration: Date.now() - startTime,
    browserDuration: metrics.duration,
    timestamp: new Date().toISOString(),
  };
}
```

## 🔧 実装チェックリスト

### 新機能追加時のチェックリスト

- [ ] **DOM構造の定義**
  - [ ] データ属性の命名規則に従っている
  - [ ] セレクタが`selectors.ts`に追加されている
  - [ ] アクセシビリティ属性が適切に設定されている

- [ ] **テスト可能性**
  - [ ] 状態の確認が可能（データ属性、クラスなど）
  - [ ] 非同期処理の完了を検知できる
  - [ ] エラー状態を外部から確認できる

- [ ] **E2Eテストの追加**
  - [ ] Page Objectが更新されている
  - [ ] 正常系・異常系のテストケースがある
  - [ ] 他の機能との統合テストがある

### コードレビューチェックリスト

- [ ] **実装とテストの整合性**
  - [ ] セレクタが実装と一致している
  - [ ] イベントの順序が正しい
  - [ ] 待機条件が適切

- [ ] **テストの品質**
  - [ ] テストが独立して実行可能
  - [ ] アサーションが明確で検証可能
  - [ ] エラーメッセージが分かりやすい

## 📚 ベストプラクティス

### 1. テストの命名規則

```typescript
describe('Feature: Drawing Tools', () => {
  describe('Rectangle Tool', () => {
    it('should create rectangle when dragging mouse', async () => {
      // Given: Rectangle tool is selected
      // When: User drags mouse on canvas
      // Then: Rectangle is created with correct dimensions
    });
    
    it('should show preview while dragging', async () => {
      // テスト実装
    });
    
    it('should cancel drawing on escape key', async () => {
      // テスト実装
    });
  });
});
```

### 2. エラーハンドリング

```typescript
test('should handle errors gracefully', async ({ page }) => {
  // エラー監視を設定
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  // テスト実行
  await performAction(page);
  
  // エラーがないことを確認
  expect(errors).toHaveLength(0);
});
```

### 3. デバッグ支援

```typescript
// デバッグモードでの実行
if (process.env.DEBUG) {
  test.use({
    headless: false,
    slowMo: 100,
    video: 'on',
    trace: 'on',
  });
}

// スクリーンショット付きアサーション
async function assertWithScreenshot(
  page: Page,
  assertion: () => Promise<void>,
  name: string
) {
  try {
    await assertion();
  } catch (error) {
    await page.screenshot({ 
      path: `debug/${name}-${Date.now()}.png`,
      fullPage: true 
    });
    throw error;
  }
}
```

## 🎯 まとめ

E2Eテストの成功は、実装とテストの密接な連携にかかっています。このガイドラインに従うことで：

1. **予測可能性**: テストが実装の変更に強くなる
2. **保守性**: テストコードの更新が容易になる
3. **信頼性**: テストの安定性が向上する
4. **効率性**: デバッグ時間が短縮される

継続的にこのガイドラインを更新し、チーム全体で共有することが重要です。