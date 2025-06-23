# 開発ガイドライン

DOMホワイトボードライブラリの開発に参加するための包括的なガイドです。

## 🚀 開発環境のセットアップ

### 必要な環境

```bash
# Node.js (LTS推奨)
node -v  # v18.0.0以上

# Yarn (パッケージマネージャー)
yarn -v  # v4.0.0以上

# Git
git --version  # v2.0.0以上
```

### セットアップ手順

```bash
# 1. リポジトリクローン
git clone [repository-url]
cd dom-wb-handson

# 2. 依存関係インストール
yarn install

# 3. 開発サーバー起動
yarn dev

# 4. テスト実行
yarn test

# 5. ビルド確認
yarn build
```

### VSCode 推奨設定

`.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.associations": {
    "*.css": "css"
  }
}
```

`.vscode/extensions.json`:
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

## 📁 プロジェクト構造

```
dom-wb-handson/
├── src/                    # ソースコード
│   ├── core/              # コアエンジン
│   │   ├── engine.ts      # WhiteboardEngine
│   │   ├── state.ts       # StateManager
│   │   └── renderer.ts    # DOMRenderer
│   ├── shapes/            # Shape定義
│   │   ├── base.ts        # BaseShape
│   │   ├── rectangle.ts   # RectangleShape
│   │   ├── ellipse.ts     # EllipseShape
│   │   └── index.ts       # エクスポート
│   ├── tools/             # ツールシステム
│   │   ├── base.ts        # BaseTool
│   │   ├── select.ts      # SelectTool
│   │   ├── rectangle.ts   # RectangleTool
│   │   └── index.ts       # エクスポート
│   ├── types/             # 型定義
│   │   ├── core.ts        # コア型
│   │   ├── shapes.ts      # Shape型
│   │   ├── tools.ts       # Tool型
│   │   └── index.ts       # エクスポート
│   ├── utils/             # ユーティリティ
│   │   ├── coordinates.ts # 座標変換
│   │   ├── geometry.ts    # 幾何学計算
│   │   ├── dom.ts         # DOM操作
│   │   └── index.ts       # エクスポート
│   ├── index.ts           # メインエントリーポイント
│   └── version.ts         # バージョン情報
├── examples/              # サンプルアプリケーション
│   ├── basic/            # 基本的な使用例
│   ├── advanced/         # 高度な使用例
│   └── demos/            # デモアプリ
├── tests/                # テストファイル
│   ├── unit/             # ユニットテスト
│   ├── integration/      # 統合テスト
│   └── e2e/              # E2Eテスト
├── docs/                 # ドキュメント
├── scripts/              # ビルドスクリプト
├── public/               # 静的ファイル
├── dist/                 # ビルド成果物
├── package.json          # パッケージ設定
├── tsconfig.json         # TypeScript設定
├── vite.config.ts        # Vite設定
├── vitest.config.ts      # テスト設定
└── README.md             # プロジェクト説明
```

## 🎯 開発フロー

### ブランチ戦略 (Git Flow)

```
main                 ← 安定版
  ↑
develop             ← 開発統合ブランチ
  ↑
feature/xxx         ← 機能開発ブランチ
hotfix/xxx          ← 緊急修正ブランチ
release/x.x.x       ← リリース準備ブランチ
```

### 作業手順

```bash
# 1. 最新のdevelopブランチから作業ブランチ作成
git checkout develop
git pull origin develop
git checkout -b feature/add-rectangle-tool

# 2. 開発作業
# ... コード変更 ...

# 3. コミット (Gitmojiを使用)
git add .
git commit -m "✨ feat: 長方形描画ツールを追加"

# 4. プッシュ
git push origin feature/add-rectangle-tool

# 5. プルリクエスト作成
# GitHub/GitLabでPRを作成
```

### コミットメッセージ規約

**Gitmoji + Conventional Commits**

```bash
# 新機能
✨ feat: ユーザー認証機能を追加

# バグ修正  
🐛 fix: ログイン時のエラーハンドリングを修正

# リファクタリング
♻️ refactor: 認証ロジックを整理

# スタイル改善
🎨 style: コードフォーマットを統一

# パフォーマンス改善
⚡️ perf: Shape描画処理を最適化

# テスト
✅ test: RectangleShapeのユニットテストを追加

# ドキュメント
📝 docs: API仕様書を更新

# 設定変更
🔧 config: TypeScript設定を調整

# 依存関係
⬆️ deps: Zustandを最新版に更新

# 削除
🔥 remove: 未使用のヘルパー関数を削除
```

## 🧩 コーディング規約

### TypeScript規約

```typescript
// ✅ Good: PascalCase for interfaces/types
interface ShapeOptions {
  type: ShapeType;
  x: number;
  y: number;
}

// ✅ Good: camelCase for variables/functions
const createRectangle = (options: ShapeOptions): Rectangle => {
  return new Rectangle(options);
};

// ✅ Good: UPPER_SNAKE_CASE for constants
const DEFAULT_GRID_SIZE = 20;
const MAX_ZOOM_LEVEL = 10;

// ✅ Good: Explicit return types
function calculateBounds(shape: Shape): Rectangle {
  // ...
}

// ✅ Good: Generic constraints
interface ShapeFactory<T extends Shape> {
  create(options: ShapeOptions): T;
}

// ❌ Bad: any type
function processData(data: any): any {
  return data.someProperty;
}

// ✅ Good: Proper typing
function processShapeData(data: ShapeData): ProcessedShape {
  return {
    id: data.id,
    bounds: calculateBounds(data),
  };
}
```

### ファイル構成規約

```typescript
// ファイルの構成順序
// 1. Import文
import { Shape, Point } from '../types';
import { calculateDistance } from '../utils';

// 2. Type definitions (ファイル内でのみ使用)
type InternalState = {
  isDragging: boolean;
  startPoint: Point;
};

// 3. Constants
const DRAG_THRESHOLD = 5;

// 4. Main class/function
export class SelectTool implements Tool {
  // ...
}

// 5. Helper functions (export不要)
function isWithinThreshold(a: Point, b: Point): boolean {
  return calculateDistance(a, b) < DRAG_THRESHOLD;
}

// 6. Default export (必要な場合)
export default SelectTool;
```

### CSS/Style規約

```css
/* BEM命名規則 */
.whiteboard__canvas {
  position: relative;
  overflow: hidden;
}

.whiteboard__shape {
  position: absolute;
  pointer-events: auto;
}

.whiteboard__shape--selected {
  outline: 2px solid #3b82f6;
}

.whiteboard__handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #ffffff;
  border: 2px solid #3b82f6;
  border-radius: 2px;
}

.whiteboard__handle--corner {
  cursor: nw-resize;
}

/* CSS Custom Properties for theming */
.whiteboard {
  --wb-primary-color: #3b82f6;
  --wb-secondary-color: #64748b;
  --wb-background-color: #ffffff;
  --wb-grid-color: #e2e8f0;
}
```

## 🧪 テスト戦略

### テストの分類と作成指針

```typescript
// Unit Test: 個別クラス/関数のテスト
describe('RectangleShape', () => {
  describe('getBounds', () => {
    it('should return correct bounds', () => {
      const rect = new RectangleShape({
        x: 10, y: 20,
        width: 100, height: 50
      });
      
      expect(rect.getBounds()).toEqual({
        x: 10, y: 20,
        width: 100, height: 50
      });
    });
    
    it('should handle rotation', () => {
      const rect = new RectangleShape({
        x: 0, y: 0,
        width: 100, height: 50,
        rotation: Math.PI / 4
      });
      
      const bounds = rect.getBounds();
      expect(bounds.width).toBeCloseTo(106.066, 2);
    });
  });
  
  describe('hitTest', () => {
    it('should detect point inside rectangle', () => {
      const rect = new RectangleShape({
        x: 0, y: 0, width: 100, height: 50
      });
      
      expect(rect.hitTest({ x: 50, y: 25 })).toBe(true);
      expect(rect.hitTest({ x: 150, y: 25 })).toBe(false);
    });
  });
});

// Integration Test: サービス間連携のテスト
describe('Engine + Tool Integration', () => {
  let engine: WhiteboardEngine;
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    engine = new WhiteboardEngine({ container });
  });
  
  afterEach(() => {
    engine.destroy();
  });
  
  it('should create shape when using rectangle tool', () => {
    // Arrange
    engine.toolManager.setActiveTool('rectangle');
    const startPoint = { x: 100, y: 100 };
    const endPoint = { x: 200, y: 150 };
    
    // Act
    simulatePointerDown(container, startPoint);
    simulatePointerMove(container, endPoint);
    simulatePointerUp(container, endPoint);
    
    // Assert
    const shapes = engine.getAllShapes();
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('rectangle');
  });
});
```

### テストヘルパー関数

```typescript
// tests/helpers/dom.ts
export function simulatePointerDown(
  element: HTMLElement, 
  point: Point
): void {
  const event = new PointerEvent('pointerdown', {
    clientX: point.x,
    clientY: point.y,
    pointerId: 1,
    bubbles: true,
  });
  element.dispatchEvent(event);
}

export function simulatePointerMove(
  element: HTMLElement, 
  point: Point
): void {
  const event = new PointerEvent('pointermove', {
    clientX: point.x,
    clientY: point.y,
    pointerId: 1,
    bubbles: true,
  });
  element.dispatchEvent(event);
}

// tests/helpers/engine.ts
export function createTestEngine(options?: Partial<WhiteboardEngineOptions>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  const engine = new WhiteboardEngine({
    container,
    width: 800,
    height: 600,
    ...options,
  });
  
  return { engine, container };
}

export function cleanupTestEngine(container: HTMLElement) {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}
```

### E2Eテスト例

```typescript
// tests/e2e/drawing.spec.ts
describe('Drawing Workflow', () => {
  it('should allow user to draw multiple rectangles', () => {
    cy.visit('/examples/basic');
    
    // Select rectangle tool
    cy.get('[data-testid="tool-rectangle"]').click();
    
    // Draw first rectangle
    cy.get('[data-testid="canvas"]')
      .trigger('pointerdown', { clientX: 100, clientY: 100 })
      .trigger('pointermove', { clientX: 200, clientY: 150 })
      .trigger('pointerup');
    
    // Verify first rectangle
    cy.get('[data-shape-type="rectangle"]').should('have.length', 1);
    
    // Draw second rectangle
    cy.get('[data-testid="canvas"]')
      .trigger('pointerdown', { clientX: 250, clientY: 200 })
      .trigger('pointermove', { clientX: 350, clientY: 250 })
      .trigger('pointerup');
    
    // Verify both rectangles
    cy.get('[data-shape-type="rectangle"]').should('have.length', 2);
    
    // Test selection
    cy.get('[data-testid="tool-select"]').click();
    cy.get('[data-shape-type="rectangle"]').first().click();
    cy.get('[data-shape-type="rectangle"]').first()
      .should('have.class', 'selected');
  });
});
```

## 🚀 パフォーマンス最適化

### 基本原則

1. **測定してから最適化**: パフォーマンス測定ツールを使用
2. **ボトルネックの特定**: 実際の問題箇所を見つける
3. **段階的改善**: 一度に多くを変更しない
4. **トレードオフの理解**: 可読性とパフォーマンスのバランス

### DOM操作の最適化

```typescript
// ❌ Bad: 個別にDOM操作
shapes.forEach(shape => {
  const element = document.createElement('div');
  element.style.left = shape.x + 'px';
  element.style.top = shape.y + 'px';
  container.appendChild(element);
});

// ✅ Good: DocumentFragmentでバッチ処理
const fragment = document.createDocumentFragment();
shapes.forEach(shape => {
  const element = document.createElement('div');
  element.style.transform = `translate(${shape.x}px, ${shape.y}px)`;
  fragment.appendChild(element);
});
container.appendChild(fragment);

// ✅ Good: CSS Transformの使用
// position変更ではなくtransformを使用してリフローを回避
element.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}rad)`;
```

### メモリ使用量の最適化

```typescript
// ✅ オブジェクトプール
class ShapePool {
  private pool = new Map<ShapeType, Shape[]>();
  
  acquire(type: ShapeType): Shape {
    const shapes = this.pool.get(type) || [];
    return shapes.pop() || this.createShape(type);
  }
  
  release(shape: Shape): void {
    shape.reset();
    const shapes = this.pool.get(shape.type) || [];
    shapes.push(shape);
    this.pool.set(shape.type, shapes);
  }
}

// ✅ WeakMapでメモリリーク防止
class ShapeElementMap {
  private map = new WeakMap<Shape, HTMLElement>();
  
  set(shape: Shape, element: HTMLElement): void {
    this.map.set(shape, element);
  }
  
  get(shape: Shape): HTMLElement | undefined {
    return this.map.get(shape);
  }
}
```

### 計算の最適化

```typescript
// ✅ メモ化による計算結果のキャッシュ
class BoundsCalculator {
  private cache = new Map<string, Rectangle>();
  
  getBounds(shape: Shape): Rectangle {
    const key = this.getCacheKey(shape);
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const bounds = this.calculateBounds(shape);
    this.cache.set(key, bounds);
    return bounds;
  }
  
  private getCacheKey(shape: Shape): string {
    return `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}`;
  }
}

// ✅ デバウンスによる処理頻度の制御
class EventHandler {
  private debounceTimeouts = new Map<string, number>();
  
  debounce(key: string, fn: Function, delay: number): void {
    const existing = this.debounceTimeouts.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    
    const timeout = setTimeout(() => {
      fn();
      this.debounceTimeouts.delete(key);
    }, delay);
    
    this.debounceTimeouts.set(key, timeout);
  }
}
```

## 🔍 デバッグ・トラブルシューティング

### デバッグツールの使用

```typescript
// 開発モードでのデバッグ機能
class DebugManager {
  private overlay?: HTMLElement;
  
  enable(): void {
    this.createDebugOverlay();
    this.enableEventLogging();
    this.showShapeBounds();
  }
  
  private createDebugOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
    `;
    document.body.appendChild(this.overlay);
  }
  
  updateStats(stats: DebugStats): void {
    if (this.overlay) {
      this.overlay.innerHTML = `
        Shapes: ${stats.shapeCount}<br>
        Selected: ${stats.selectedCount}<br>
        FPS: ${stats.fps}<br>
        Memory: ${stats.memoryUsage}MB
      `;
    }
  }
}

// パフォーマンス測定
class PerformanceProfiler {
  measure<T>(name: string, fn: () => T): T {
    performance.mark(`${name}-start`);
    const result = fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
    
    return result;
  }
}
```

### よくある問題と解決方法

```typescript
// Issue: メモリリーク
// Solution: 適切なクリーンアップ
class WhiteboardEngine {
  private listeners: Array<() => void> = [];
  
  destroy(): void {
    // イベントリスナーの削除
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
    
    // DOM要素の削除
    this.container.innerHTML = '';
    
    // 循環参照の削除
    this.shapes.clear();
    this.selectedShapes.clear();
  }
}

// Issue: 座標がずれる
// Solution: 適切な座標変換
class CoordinateTransformer {
  screenToWorld(screenPoint: Point, camera: Camera): Point {
    // コンテナの境界を考慮
    const rect = this.container.getBoundingClientRect();
    const containerPoint = {
      x: screenPoint.x - rect.left,
      y: screenPoint.y - rect.top,
    };
    
    // カメラ変換を適用
    return {
      x: (containerPoint.x - this.viewport.width / 2) / camera.zoom + camera.x,
      y: (containerPoint.y - this.viewport.height / 2) / camera.zoom + camera.y,
    };
  }
}

// Issue: パフォーマンス低下
// Solution: 仮想化と最適化
class ShapeRenderer {
  render(shapes: Shape[], camera: Camera): void {
    // 可視範囲のShapeのみを描画
    const visibleShapes = this.cullShapes(shapes, camera);
    
    // バッチ更新でリフローを最小化
    this.batchUpdates(() => {
      visibleShapes.forEach(shape => {
        this.updateShapeElement(shape);
      });
    });
  }
}
```

## 📦 リリース・デプロイ

### バージョン管理

```bash
# パッチバージョン (バグ修正)
yarn version patch  # 1.0.0 → 1.0.1

# マイナーバージョン (新機能)
yarn version minor  # 1.0.0 → 1.1.0

# メジャーバージョン (破壊的変更)
yarn version major  # 1.0.0 → 2.0.0
```

### ビルドプロセス

```bash
# 開発ビルド
yarn build:dev

# プロダクションビルド
yarn build:prod

# 型定義ファイル生成
yarn build:types

# 全体ビルド
yarn build
```

### チェックリスト

- [ ] 全テストが通る
- [ ] TypeScriptエラーがない
- [ ] Lintエラーがない
- [ ] ドキュメントが更新されている
- [ ] CHANGELOGが更新されている
- [ ] パフォーマンステストが通る

---

📖 **関連ドキュメント**
- [API仕様書](../api/) - 詳細なAPI リファレンス
- [アーキテクチャ](../architecture/) - システム設計の詳細
- [サンプルコード](../examples/) - 実装例とベストプラクティス