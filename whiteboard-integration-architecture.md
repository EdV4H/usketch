# Whiteboard統合アーキテクチャ設計

## 概要

このドキュメントは、monorepo構造におけるWhiteboardアプリケーションの統合アーキテクチャを定義します。特にcanvas-core、drawing-tools、ui-componentsパッケージの統合方法について詳述します。

## アーキテクチャ概観

```
┌─────────────────────────────────────────────────────────┐
│                    apps/whiteboard                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    main.ts                        │   │
│  │  - アプリケーション初期化                          │   │
│  │  - DI コンテナ設定                               │   │
│  │  - ツールバーUI                                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 @whiteboard/canvas-core                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │              WhiteboardCanvas                     │   │
│  │  - レイヤー管理（Grid, Shapes, Selection）        │   │
│  │  - イベントディスパッチ                           │   │
│  │  - カメラ制御（パン・ズーム）                      │   │
│  │  - レンダリングオーケストレーション                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│@whiteboard/store │ │@whiteboard/      │ │@whiteboard/      │
│                  │ │drawing-tools     │ │ui-components     │
│ - 状態管理        │ │                  │ │                  │
│ - Zustand store  │ │ - ToolManager    │ │ - SelectionLayer │
│ - Actions        │ │ - Tool interface │ │ - Grid           │
│                  │ │ - 各種ツール      │ │ - Toolbar        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                    │                    │
          └────────────────────┴────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │@whiteboard/      │
                    │shared-types      │
                    │                  │
                    │ - 共通型定義      │
                    │ - インターフェース │
                    └──────────────────┘
```

## パッケージ間の依存関係

### 1. @whiteboard/shared-types（最下層）
```typescript
// 基本的な型定義のみ
export interface Point { x: number; y: number; }
export interface Shape { id: string; type: string; /* ... */ }
export interface Camera { x: number; y: number; zoom: number; }
export interface WhiteboardState { /* ... */ }
```

### 2. @whiteboard/shared-utils
```typescript
// 純粋関数のユーティリティ
import type { Point, Camera } from '@whiteboard/shared-types';

export function screenToCanvas(point: Point, camera: Camera): Point { /* ... */ }
export function canvasToScreen(point: Point, camera: Camera): Point { /* ... */ }
```

### 3. @whiteboard/store
```typescript
// 状態管理層
import { create } from 'zustand';
import type { WhiteboardState } from '@whiteboard/shared-types';

export interface WhiteboardStore extends WhiteboardState {
  // Actions
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  // ...
}

export const createWhiteboardStore = () => create<WhiteboardStore>(/* ... */);
```

### 4. @whiteboard/drawing-tools
```typescript
// 依存性注入パターンを使用
import type { WhiteboardStore } from '@whiteboard/store';
import type { Point } from '@whiteboard/shared-types';

export interface ToolContext {
  store: WhiteboardStore;
  canvas: HTMLElement;
}

export interface Tool {
  name: string;
  onPointerDown?: (event: PointerEvent, context: ToolContext) => void;
  onPointerMove?: (event: PointerEvent, context: ToolContext) => void;
  onPointerUp?: (event: PointerEvent, context: ToolContext) => void;
}

export class ToolManager {
  constructor(private context: ToolContext) {}
  // ...
}
```

### 5. @whiteboard/ui-components
```typescript
// UIコンポーネント層
import type { Shape } from '@whiteboard/shared-types';

export interface SelectionLayerProps {
  selectedShapes: Shape[];
  onResize?: (id: string, bounds: DOMRect) => void;
}

export class SelectionLayer {
  constructor(private container: HTMLElement, private props: SelectionLayerProps) {}
  // ...
}
```

### 6. @whiteboard/canvas-core
```typescript
// 中心的な統合層
import { ToolManager, type ToolContext } from '@whiteboard/drawing-tools';
import { SelectionLayer } from '@whiteboard/ui-components';
import type { WhiteboardStore } from '@whiteboard/store';

export interface CanvasConfig {
  container: HTMLElement;
  store: WhiteboardStore;
  tools?: Tool[];
}

export class WhiteboardCanvas {
  private toolManager: ToolManager;
  private selectionLayer: SelectionLayer;
  
  constructor(config: CanvasConfig) {
    // 依存性注入
    const toolContext: ToolContext = {
      store: config.store,
      canvas: this.shapesContainer
    };
    
    this.toolManager = new ToolManager(toolContext);
    this.selectionLayer = new SelectionLayer(this.selectionContainer, {
      selectedShapes: [],
      onResize: this.handleResize.bind(this)
    });
    
    // ストアの変更を購読
    config.store.subscribe(this.render.bind(this));
  }
}
```

### 7. apps/whiteboard（最上位統合）
```typescript
// main.ts
import { WhiteboardCanvas } from '@whiteboard/canvas-core';
import { createWhiteboardStore } from '@whiteboard/store';
import { SelectTool, RectangleTool } from '@whiteboard/drawing-tools';

// アプリケーション初期化
const store = createWhiteboardStore();

const canvas = new WhiteboardCanvas({
  container: document.getElementById('whiteboard')!,
  store,
  tools: [
    new SelectTool(),
    new RectangleTool()
  ]
});

// ツールバーのイベントハンドリング
document.getElementById('select-tool')?.addEventListener('click', () => {
  store.setCurrentTool('select');
});
```

## 依存性注入（DI）パターン

### 1. コンテキストベースDI
```typescript
// ツールがストアに直接依存せず、コンテキスト経由でアクセス
export class RectangleTool implements Tool {
  onPointerDown(event: PointerEvent, context: ToolContext) {
    const point = screenToCanvas({ x: event.clientX, y: event.clientY }, context.store.getState().camera);
    
    context.store.addShape({
      id: generateId(),
      type: 'rectangle',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0
    });
  }
}
```

### 2. ファクトリーパターン
```typescript
// パッケージごとにファクトリー関数を提供
export function createToolManager(context: ToolContext): ToolManager {
  return new ToolManager(context);
}

export function createSelectionLayer(container: HTMLElement, props: SelectionLayerProps): SelectionLayer {
  return new SelectionLayer(container, props);
}
```

### 3. プロバイダーパターン（将来的な拡張）
```typescript
// より複雑なDIが必要になった場合
export class WhiteboardProvider {
  private services = new Map();
  
  register<T>(token: string, factory: () => T): void {
    this.services.set(token, factory);
  }
  
  get<T>(token: string): T {
    const factory = this.services.get(token);
    if (!factory) throw new Error(`Service ${token} not found`);
    return factory();
  }
}
```

## ビルド最適化

### 1. Tree Shaking
各パッケージは個別にビルドされ、使用されない機能は自動的に除外されます。

### 2. Code Splitting
```typescript
// 動的インポートによる遅延読み込み
const loadAdvancedTools = async () => {
  const { PenTool, EraserTool } = await import('@whiteboard/drawing-tools/advanced');
  return [new PenTool(), new EraserTool()];
};
```

### 3. 共通依存関係の最適化
Viteの設定で共通モジュールを別チャンクに分離：
```javascript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor': ['zustand'],
        'core': ['@whiteboard/shared-types', '@whiteboard/shared-utils']
      }
    }
  }
}
```

## テスト戦略

### 1. 単体テスト
各パッケージは独立してテスト可能：
```typescript
// packages/drawing-tools/src/__tests__/RectangleTool.test.ts
import { RectangleTool } from '../RectangleTool';
import { createMockContext } from '../test-utils';

test('creates rectangle on pointer down', () => {
  const context = createMockContext();
  const tool = new RectangleTool();
  
  tool.onPointerDown(mockPointerEvent, context);
  
  expect(context.store.addShape).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'rectangle' })
  );
});
```

### 2. 統合テスト
```typescript
// apps/whiteboard/src/__tests__/integration.test.ts
import { WhiteboardCanvas } from '@whiteboard/canvas-core';
import { createWhiteboardStore } from '@whiteboard/store';

test('canvas integrates with store and tools', async () => {
  const store = createWhiteboardStore();
  const canvas = new WhiteboardCanvas({ container, store });
  
  // 統合動作のテスト
});
```

## パフォーマンス考慮事項

### 1. レンダリング最適化
- 仮想DOM不使用、直接DOM操作による高速レンダリング
- 変更検知による差分更新
- requestAnimationFrameによるバッチ更新

### 2. メモリ管理
- イベントリスナーの適切なクリーンアップ
- 大量のシェイプに対するビューポートカリング
- WeakMapを使用したキャッシュ

### 3. バンドルサイズ最適化
- 各パッケージの最小化
- 動的インポートによる初期ロード削減
- 本番ビルドでの開発用コード削除

## 将来の拡張性

### 1. プラグインシステム
```typescript
export interface WhiteboardPlugin {
  name: string;
  install(canvas: WhiteboardCanvas): void;
}
```

### 2. カスタムツールの追加
```typescript
// ユーザー定義ツール
class CustomTool implements Tool {
  // 実装
}

canvas.registerTool(new CustomTool());
```

### 3. テーマシステム
```typescript
export interface Theme {
  colors: Record<string, string>;
  fonts: Record<string, string>;
}

canvas.setTheme(customTheme);
```