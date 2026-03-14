# アーキテクチャ設計書

DOMホワイトボードライブラリの詳細なアーキテクチャ設計について説明します。

## 🎯 設計方針

### ヘッドレス設計の理念

```
┌─────────────────────────────────────────────────┐
│           ユーザーアプリケーション                │
│         (UI + スタイリング + ビジネスロジック)     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐  │
│  │  Toolbar    │  │   Canvas    │  │ Panel   │  │
│  │             │  │             │  │         │  │
│  └─────────────┘  └─────────────┘  └─────────┘  │
│                                                 │
└─────────────────┬───────────────────────────────┘
                  │ API Calls
┌─────────────────▼───────────────────────────────┐
│           DOM Whiteboard Library                │
│              (ヘッドレスライブラリ)               │
├─────────────────────────────────────────────────┤
│  Engine  │  Tools  │  State  │  Events │ Utils  │
└─────────────────────────────────────────────────┘
```

**核心原則:**
- **分離**: UIとロジックの完全な分離
- **拡張性**: プラグイン可能なアーキテクチャ
- **パフォーマンス**: DOM + CSS Transformによる高速描画
- **型安全性**: TypeScriptによる堅牢な型システム

## 🏛️ システムアーキテクチャ

### レイヤード構造

```
┌─────────────────────────────────────────────────┐
│                API Layer                        │
│  WhiteboardEngine | ToolManager | EventEmitter │
├─────────────────────────────────────────────────┤
│               Service Layer                     │
│   StateManager | ShapeService | CameraService  │
├─────────────────────────────────────────────────┤
│               Core Layer                        │
│     Shape System | Coordinate System | Tools   │
├─────────────────────────────────────────────────┤
│              Rendering Layer                    │
│      DOM Renderer | CSS Transform Engine       │
├─────────────────────────────────────────────────┤
│              Platform Layer                     │
│     Event System | Browser APIs | Utilities    │
└─────────────────────────────────────────────────┘
```

## 🧩 コンポーネント設計

### 1. WhiteboardEngine (中央エンジン)

```typescript
class WhiteboardEngine {
  private stateManager: StateManager;
  private shapeService: ShapeService;
  private toolManager: ToolManager;
  private renderer: DOMRenderer;
  private eventEmitter: EventEmitter;
  private cameraService: CameraService;
  
  constructor(options: WhiteboardEngineOptions) {
    this.initializeServices();
    this.setupEventHandlers();
    this.bindDOMEvents();
  }
}
```

**責務:**
- サービス間の調整とライフサイクル管理
- 外部APIの提供
- イベントの中継とディスパッチ

### 2. StateManager (状態管理)

```typescript
class StateManager {
  private store: WhiteboardStore;
  private subscribers: Map<string, Function[]>;
  
  // Zustand風のシンプルな状態管理
  getState(): WhiteboardState;
  setState(partial: Partial<WhiteboardState>): void;
  subscribe(selector: Function, callback: Function): void;
  
  // 最適化された更新
  updateShapes(updates: ShapeUpdate[]): void;
  batchUpdates(fn: () => void): void;
}
```

**特徴:**
- **不変性**: Immerを使用したイミュータブル更新
- **選択的購読**: 必要な部分のみの再描画
- **バッチ更新**: パフォーマンス最適化

### 3. Shape System (シェイプシステム)

```typescript
// Shape Factory Pattern
class ShapeFactory {
  static create(options: CreateShapeOptions): Shape {
    switch (options.type) {
      case 'rectangle': return new RectangleShape(options);
      case 'ellipse': return new EllipseShape(options);
      case 'line': return new LineShape(options);
      case 'text': return new TextShape(options);
      case 'freehand': return new FreehandShape(options);
    }
  }
}

// Shape Base Class
abstract class BaseShape implements Shape {
  abstract render(renderer: DOMRenderer): HTMLElement;
  abstract getBounds(): Rectangle;
  abstract hitTest(point: Point): boolean;
  abstract transform(matrix: TransformMatrix): void;
  
  // 共通機能
  clone(): Shape { /* ... */ }
  serialize(): ShapeData { /* ... */ }
  deserialize(data: ShapeData): void { /* ... */ }
}
```

**設計パターン:**
- **Factory Pattern**: Shape作成の統一化
- **Strategy Pattern**: 描画・当たり判定の多態性
- **Prototype Pattern**: Shapeのクローン機能

### 4. Tool System (ツールシステム)

```typescript
// Tool State Machine
class ToolStateMachine {
  private currentState: ToolState;
  private stateHandlers: Map<string, ToolStateHandler>;
  
  transition(event: ToolEvent): void {
    const handler = this.stateHandlers.get(this.currentState);
    const nextState = handler.handle(event);
    if (nextState !== this.currentState) {
      this.currentState = nextState;
      this.emit('state:changed', { from: this.currentState, to: nextState });
    }
  }
}

// Rectangle Tool Example
class RectangleTool extends BaseTool {
  private states = {
    idle: new IdleState(),
    drawing: new DrawingState(),
    complete: new CompleteState(),
  };
  
  onPointerDown(event: PointerEvent) {
    this.stateMachine.transition({
      type: 'pointer:down',
      point: this.engine.screenToWorld(event),
    });
  }
}
```

**特徴:**
- **ステートマシン**: 複雑なインタラクションの管理
- **コマンドパターン**: Undo/Redo対応
- **プラグイン機能**: カスタムツールの追加

### 5. DOM Renderer (描画エンジン)

```typescript
class DOMRenderer {
  private container: HTMLElement;
  private shapeElements: Map<string, HTMLElement>;
  private transformCache: Map<string, string>;
  
  render(shapes: Shape[], camera: Camera): void {
    // 仮想化: 可視範囲のみ描画
    const visibleShapes = this.cullShapes(shapes, camera);
    
    // バッチ更新でリフロー最小化
    this.batchUpdates(() => {
      visibleShapes.forEach(shape => {
        this.updateShapeElement(shape, camera);
      });
    });
  }
  
  updateShapeElement(shape: Shape, camera: Camera): void {
    const element = this.getOrCreateElement(shape);
    const transform = this.calculateTransform(shape, camera);
    
    // CSS Transform使用で高速描画
    if (this.transformCache.get(shape.id) !== transform) {
      element.style.transform = transform;
      this.transformCache.set(shape.id, transform);
    }
  }
}
```

**最適化技術:**
- **仮想化**: 大量Shape処理
- **CSS Transform**: GPU加速活用
- **バッチ更新**: リフロー/リペイント最小化
- **変更検出**: 不要な更新の回避

## 🔄 データフロー

### 単方向データフロー

```
User Interaction
       ↓
   Event Handler
       ↓
   Tool Processing
       ↓
   State Update
       ↓
   View Update
```

### 詳細なデータフロー例

```typescript
// 1. ユーザー操作
canvas.addEventListener('pointerdown', (e) => {
  
  // 2. イベント正規化
  const event = normalizePointerEvent(e);
  
  // 3. アクティブツールに委譲
  const tool = this.toolManager.getActiveTool();
  tool.onPointerDown(event, this.engine);
  
  // 4. ツール内でのState更新
  this.engine.setState({
    selectedShapeIds: [shapeId],
    tool: { mode: 'dragging', startPoint: point }
  });
  
  // 5. State変更の検知と伝播
  this.stateManager.notify('selection:changed');
  
  // 6. View更新
  this.renderer.updateSelection();
});
```

## 🎨 座標系とトランスフォーム

### 座標系の階層

```
World Space (ワールド座標)
    ↓ Camera Transform
Screen Space (スクリーン座標)  
    ↓ DOM Transform
Element Space (要素座標)
```

### 座標変換の実装

```typescript
class CoordinateSystem {
  worldToScreen(point: Point, camera: Camera, viewport: Viewport): Point {
    return {
      x: (point.x - camera.x) * camera.zoom + viewport.width / 2,
      y: (point.y - camera.y) * camera.zoom + viewport.height / 2,
    };
  }
  
  screenToWorld(point: Point, camera: Camera, viewport: Viewport): Point {
    return {
      x: (point.x - viewport.width / 2) / camera.zoom + camera.x,
      y: (point.y - viewport.height / 2) / camera.zoom + camera.y,
    };
  }
  
  // マトリックス変換による高速計算
  createTransformMatrix(shape: Shape, camera: Camera): TransformMatrix {
    const screenPos = this.worldToScreen(shape, camera);
    return new TransformMatrix()
      .translate(screenPos.x, screenPos.y)
      .rotate(shape.rotation)
      .scale(camera.zoom, camera.zoom);
  }
}
```

## 🚀 パフォーマンス最適化

### 1. 描画最適化

```typescript
class PerformanceOptimizer {
  // 仮想化: 可視範囲外の要素を非表示
  cullShapes(shapes: Shape[], viewport: Rectangle): Shape[] {
    return shapes.filter(shape => 
      this.intersects(shape.bounds, viewport)
    );
  }
  
  // LOD (Level of Detail): ズームレベルに応じた詳細度
  getLOD(shape: Shape, zoom: number): DetailLevel {
    if (zoom < 0.1) return 'minimal';
    if (zoom < 0.5) return 'low';
    if (zoom < 2.0) return 'medium';
    return 'high';
  }
  
  // バッチ更新: DOM操作をまとめて実行
  batchUpdates(updates: () => void): void {
    this.isUpdating = true;
    updates();
    this.isUpdating = false;
    this.flushUpdates();
  }
}
```

### 2. メモリ最適化

```typescript
class MemoryManager {
  private shapePool: Map<ShapeType, Shape[]>;
  private elementPool: HTMLElement[];
  
  // オブジェクトプール: Shape作成コストを削減
  getShape(type: ShapeType): Shape {
    const pool = this.shapePool.get(type);
    return pool.length > 0 ? pool.pop()! : this.createShape(type);
  }
  
  releaseShape(shape: Shape): void {
    shape.reset();
    this.shapePool.get(shape.type).push(shape);
  }
  
  // WeakRef使用でメモリリークを防止
  private elementRefs = new WeakMap<Shape, HTMLElement>();
}
```

### 3. 非同期処理

```typescript
class AsyncProcessor {
  // Web Workerでの重い計算処理
  async calculateBounds(shapes: Shape[]): Promise<Rectangle[]> {
    return new Promise((resolve) => {
      this.worker.postMessage({ type: 'calculate-bounds', shapes });
      this.worker.onmessage = (e) => resolve(e.data.bounds);
    });
  }
  
  // RequestAnimationFrameでのスムーズな更新
  scheduleUpdate(fn: () => void): void {
    if (!this.pendingUpdate) {
      this.pendingUpdate = requestAnimationFrame(() => {
        fn();
        this.pendingUpdate = null;
      });
    }
  }
}
```

## 🔌 プラグインアーキテクチャ

### プラグインシステム

```typescript
interface Plugin {
  name: string;
  version: string;
  dependencies?: string[];
  
  install(engine: WhiteboardEngine): void;
  uninstall(engine: WhiteboardEngine): void;
}

class PluginManager {
  private plugins = new Map<string, Plugin>();
  private hooks = new Map<string, Function[]>();
  
  register(plugin: Plugin): void {
    this.validateDependencies(plugin);
    plugin.install(this.engine);
    this.plugins.set(plugin.name, plugin);
  }
  
  // Hook システム
  addHook(name: string, fn: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(fn);
  }
  
  runHooks(name: string, ...args: any[]): void {
    const hooks = this.hooks.get(name) || [];
    hooks.forEach(hook => hook(...args));
  }
}
```

### プラグイン例

```typescript
// グリッドスナップ機能のプラグイン
class GridSnapPlugin implements Plugin {
  name = 'grid-snap';
  version = '1.0.0';
  
  install(engine: WhiteboardEngine): void {
    // Shape移動時にスナップ処理を追加
    engine.pluginManager.addHook('shape:beforeMove', (shape, newPosition) => {
      if (engine.getState().snapToGrid) {
        const gridSize = engine.getState().gridSize;
        return {
          x: Math.round(newPosition.x / gridSize) * gridSize,
          y: Math.round(newPosition.y / gridSize) * gridSize,
        };
      }
      return newPosition;
    });
  }
}
```

## 🧪 テスト戦略

### テストピラミッド

```
┌─────────────────────────────────┐
│           E2E Tests             │  ← Cypress/Playwright
├─────────────────────────────────┤
│       Integration Tests         │  ← Testing Library  
├─────────────────────────────────┤
│          Unit Tests             │  ← Vitest/Jest
└─────────────────────────────────┘
```

### テストの分類

```typescript
// Unit Tests: 個別クラスのテスト
describe('ShapeFactory', () => {
  it('should create rectangle shape', () => {
    const shape = ShapeFactory.create({
      type: 'rectangle',
      x: 0, y: 0,
      width: 100, height: 50
    });
    expect(shape.type).toBe('rectangle');
    expect(shape.getBounds()).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
});

// Integration Tests: サービス間連携のテスト  
describe('Engine Integration', () => {
  it('should update view when shape is added', () => {
    const engine = new WhiteboardEngine({ container });
    const shape = engine.addShape({ type: 'rectangle', x: 0, y: 0 });
    
    expect(container.querySelector(`[data-shape-id="${shape.id}"]`)).toBeTruthy();
  });
});

// E2E Tests: ユーザーシナリオのテスト
describe('Drawing Rectangle', () => {
  it('should create rectangle by drag', () => {
    cy.visit('/whiteboard');
    cy.get('[data-tool="rectangle"]').click();
    cy.get('[data-testid="canvas"]')
      .trigger('pointerdown', { clientX: 100, clientY: 100 })
      .trigger('pointermove', { clientX: 200, clientY: 150 })
      .trigger('pointerup');
    
    cy.get('[data-shape-type="rectangle"]').should('exist');
  });
});
```

## 📊 モニタリングと診断

### パフォーマンス計測

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, PerformanceEntry[]>();
  
  measure(name: string, fn: () => void): void {
    const start = performance.now();
    fn();
    const end = performance.now();
    
    this.recordMetric(name, end - start);
  }
  
  // レンダリングパフォーマンスの計測
  measureRender(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'render') {
          this.recordMetric('render-time', entry.duration);
        }
      }
    });
    observer.observe({ entryTypes: ['mark', 'measure'] });
  }
}
```

### デバッグ機能

```typescript
class DebugManager {
  private enabled = false;
  
  enable(): void {
    this.enabled = true;
    this.addDebugOverlay();
    this.enableEventLogging();
  }
  
  private addDebugOverlay(): void {
    // Shape境界の表示
    // 選択ハンドルの表示
    // パフォーマンス情報の表示
  }
  
  logEvent(event: WhiteboardEvent): void {
    if (this.enabled) {
      console.group(`Event: ${event.type}`);
      console.log('Data:', event.data);
      console.log('Timestamp:', event.timestamp);
      console.groupEnd();
    }
  }
}
```

## 🔮 将来の拡張性

### 計画されている機能

1. **共同編集**: CRDT (Conflict-free Replicated Data Types) による同期
2. **レイヤーシステム**: Shapeのグループ化と階層管理
3. **アニメーション**: CSS/Web Animationsによるスムーズなトランジション
4. **SVGエクスポート**: ベクター形式での出力機能
5. **画像取り込み**: 画像Shape + OCR機能

### 技術的課題への対応

- **大規模データ**: 仮想化 + ページング
- **複雑なShape**: WebGL/Canvas2Dとのハイブリッド
- **リアルタイム同期**: WebRTC + WebSocket
- **モバイル対応**: タッチイベント最適化

---

📖 **関連ドキュメント**
- [API仕様書](../api/) - 詳細なAPI リファレンス
- [開発ガイド](../development/) - 実装ガイドライン
- [パフォーマンスガイド](./performance.md) - 最適化の詳細
- [座標変換戦略](./coordinate-conversion-strategy.md) - 座標変換アーキテクチャの設計判断