# 依存性注入（DI）パターン実装例

## 概要

monorepo構造でのパッケージ間の疎結合を実現するためのDIパターンの具体的な実装例を示します。

## 1. 現在の問題点と解決策

### 問題：ツールがストアを直接インポート
```typescript
// ❌ 現在の実装（密結合）
import { useWhiteboardStore } from '../store';

export class RectangleTool implements Tool {
  onPointerDown(event: PointerEvent) {
    const store = useWhiteboardStore.getState();
    store.addShape(/* ... */);
  }
}
```

### 解決：コンテキストベースのDI
```typescript
// ✅ 改善された実装（疎結合）
export interface ToolContext {
  store: {
    addShape: (shape: Shape) => void;
    updateShape: (id: string, updates: Partial<Shape>) => void;
    getState: () => WhiteboardState;
  };
  canvas: HTMLElement;
  utils: {
    screenToCanvas: (point: Point, camera: Camera) => Point;
    generateId: () => string;
  };
}

export class RectangleTool implements Tool {
  onPointerDown(event: PointerEvent, context: ToolContext) {
    const state = context.store.getState();
    const point = context.utils.screenToCanvas(
      { x: event.clientX, y: event.clientY },
      state.camera
    );
    
    context.store.addShape({
      id: context.utils.generateId(),
      type: 'rectangle',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0
    });
  }
}
```

## 2. ToolManagerの実装

```typescript
// packages/drawing-tools/src/ToolManager.ts
export class ToolManager {
  private currentTool: Tool | null = null;
  private tools = new Map<string, Tool>();
  
  constructor(private context: ToolContext) {}
  
  registerTool(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }
  
  setActiveTool(name: string): void {
    const tool = this.tools.get(name);
    if (tool) {
      this.currentTool = tool;
    }
  }
  
  handlePointerDown(event: PointerEvent): void {
    if (this.currentTool?.onPointerDown) {
      this.currentTool.onPointerDown(event, this.context);
    }
  }
  
  handlePointerMove(event: PointerEvent): void {
    if (this.currentTool?.onPointerMove) {
      this.currentTool.onPointerMove(event, this.context);
    }
  }
  
  handlePointerUp(event: PointerEvent): void {
    if (this.currentTool?.onPointerUp) {
      this.currentTool.onPointerUp(event, this.context);
    }
  }
}
```

## 3. Canvas統合層での実装

```typescript
// packages/canvas-core/src/WhiteboardCanvas.ts
import { ToolManager } from '@whiteboard/drawing-tools';
import { SelectionLayer } from '@whiteboard/ui-components';
import type { WhiteboardStore } from '@whiteboard/store';
import * as utils from '@whiteboard/shared-utils';

export interface CanvasConfig {
  container: HTMLElement;
  store: WhiteboardStore;
}

export class WhiteboardCanvas {
  private toolManager: ToolManager;
  private selectionLayer: SelectionLayer;
  private shapesContainer: HTMLElement;
  
  constructor(private config: CanvasConfig) {
    this.setupDOM();
    this.setupToolManager();
    this.setupSelectionLayer();
    this.setupEventHandlers();
    this.subscribeToStore();
  }
  
  private setupToolManager(): void {
    // ToolContextの作成
    const toolContext = {
      store: {
        addShape: this.config.store.addShape,
        updateShape: this.config.store.updateShape,
        deleteShape: this.config.store.deleteShape,
        getState: () => this.config.store.getState()
      },
      canvas: this.shapesContainer,
      utils: {
        screenToCanvas: utils.screenToCanvas,
        canvasToScreen: utils.canvasToScreen,
        generateId: utils.generateId
      }
    };
    
    this.toolManager = new ToolManager(toolContext);
  }
  
  private setupSelectionLayer(): void {
    const selectionProps = {
      selectedShapes: [],
      onResize: (id: string, bounds: DOMRect) => {
        this.config.store.updateShape(id, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        });
      },
      onDelete: (id: string) => {
        this.config.store.deleteShape(id);
      }
    };
    
    this.selectionLayer = new SelectionLayer(
      this.selectionContainer,
      selectionProps
    );
  }
  
  // ツールの登録
  registerTool(name: string, tool: Tool): void {
    this.toolManager.registerTool(name, tool);
  }
  
  // アクティブツールの設定
  setActiveTool(name: string): void {
    this.toolManager.setActiveTool(name);
  }
}
```

## 4. アプリケーション層での使用

```typescript
// apps/whiteboard/src/main.ts
import { WhiteboardCanvas } from '@whiteboard/canvas-core';
import { createWhiteboardStore } from '@whiteboard/store';
import { SelectTool, RectangleTool } from '@whiteboard/drawing-tools';

// ストアの作成
const store = createWhiteboardStore();

// Canvasの初期化
const canvas = new WhiteboardCanvas({
  container: document.getElementById('whiteboard')!,
  store
});

// ツールの登録
canvas.registerTool('select', new SelectTool());
canvas.registerTool('rectangle', new RectangleTool());

// 初期ツールの設定
canvas.setActiveTool('select');

// ツールバーのイベントハンドリング
document.getElementById('select-tool')?.addEventListener('click', () => {
  canvas.setActiveTool('select');
  store.setCurrentTool('select');
});

document.getElementById('rectangle-tool')?.addEventListener('click', () => {
  canvas.setActiveTool('rectangle');
  store.setCurrentTool('rectangle');
});
```

## 5. テスト容易性の向上

### モックコンテキストの作成
```typescript
// packages/drawing-tools/src/test-utils/mockContext.ts
export function createMockContext(): ToolContext {
  return {
    store: {
      addShape: jest.fn(),
      updateShape: jest.fn(),
      deleteShape: jest.fn(),
      getState: jest.fn(() => ({
        shapes: [],
        selectedShapeIds: [],
        camera: { x: 0, y: 0, zoom: 1 },
        currentTool: 'select'
      }))
    },
    canvas: document.createElement('div'),
    utils: {
      screenToCanvas: jest.fn((point) => point),
      canvasToScreen: jest.fn((point) => point),
      generateId: jest.fn(() => 'test-id')
    }
  };
}
```

### ツールのユニットテスト
```typescript
// packages/drawing-tools/src/__tests__/RectangleTool.test.ts
import { RectangleTool } from '../RectangleTool';
import { createMockContext } from '../test-utils/mockContext';

describe('RectangleTool', () => {
  let tool: RectangleTool;
  let context: ToolContext;
  
  beforeEach(() => {
    tool = new RectangleTool();
    context = createMockContext();
  });
  
  test('creates rectangle on pointer down', () => {
    const event = new PointerEvent('pointerdown', {
      clientX: 100,
      clientY: 200
    });
    
    tool.onPointerDown(event, context);
    
    expect(context.store.addShape).toHaveBeenCalledWith({
      id: 'test-id',
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 0,
      height: 0
    });
  });
});
```

## 6. 高度なDIパターン（将来の拡張）

### サービスロケーターパターン
```typescript
// packages/core/src/ServiceLocator.ts
export class ServiceLocator {
  private static instance: ServiceLocator;
  private services = new Map<string, any>();
  
  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }
  
  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }
  
  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service ${key} not found`);
    }
    return service;
  }
}

// 使用例
const locator = ServiceLocator.getInstance();
locator.register('store', store);
locator.register('toolManager', toolManager);

// ツール内で使用
const store = ServiceLocator.getInstance().get<WhiteboardStore>('store');
```

### インターフェース分離の原則
```typescript
// 各ツールが必要な最小限のインターフェースのみ依存
export interface ShapeCreator {
  addShape: (shape: Shape) => void;
}

export interface ShapeUpdater {
  updateShape: (id: string, updates: Partial<Shape>) => void;
}

export interface StateReader {
  getState: () => WhiteboardState;
}

// ツールは必要なインターフェースのみ要求
export class SelectTool implements Tool {
  constructor(
    private updater: ShapeUpdater,
    private reader: StateReader
  ) {}
}
```

## まとめ

このDIパターンにより：
1. **パッケージ間の疎結合**：各パッケージは具体的な実装ではなくインターフェースに依存
2. **テスト容易性**：モックを使った単体テストが簡単に
3. **拡張性**：新しいツールやコンポーネントの追加が容易
4. **保守性**：変更の影響範囲が限定的

これらのパターンを採用することで、大規模なmonorepoプロジェクトでも管理しやすい構造を維持できます。