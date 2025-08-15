# API仕様書

DOMホワイトボードライブラリのAPI仕様とTypeScript型定義を説明します。

## 📋 概要

このライブラリは完全にヘッドレスで設計されており、以下の3つの主要なAPIレイヤーを提供します：

1. **Core API** - 基本的なエンジンとデータ構造
2. **Tools API** - インタラクションとツールシステム
3. **Events API** - 状態変更の監視とイベント処理

## 🏗️ Core API

### WhiteboardEngine

メインのエンジンクラスです。

```typescript
class WhiteboardEngine {
  constructor(options: WhiteboardEngineOptions);
  
  // Shape管理
  addShape(shape: CreateShapeOptions): Shape;
  updateShape(id: string, updates: Partial<Shape>): void;
  removeShape(id: string): void;
  getShape(id: string): Shape | undefined;
  getAllShapes(): Shape[];
  
  // 選択管理
  selectShape(id: string): void;
  deselectShape(id: string): void;
  getSelectedShapes(): Shape[];
  clearSelection(): void;
  
  // カメラ・ビューポート
  setCamera(camera: Partial<Camera>): void;
  getCamera(): Camera;
  zoomIn(point?: Point): void;
  zoomOut(point?: Point): void;
  panTo(point: Point): void;
  
  // 座標変換
  worldToScreen(point: Point): Point;
  screenToWorld(point: Point): Point;
  
  // 状態管理
  getState(): WhiteboardState;
  setState(state: Partial<WhiteboardState>): void;
  
  // イベント
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, data?: any): void;
  
  // ライフサイクル
  destroy(): void;
}
```

### 初期化オプション

```typescript
interface WhiteboardEngineOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  initialCamera?: Partial<Camera>;
  gridSize?: number;
  showGrid?: boolean;
  minZoom?: number;
  maxZoom?: number;
}
```

## 🎨 Shape Types

### 基本Shape構造

```typescript
interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;         // ワールド座標
  y: number;         // ワールド座標
  rotation: number;  // ラジアン
  opacity: number;   // 0-1
  visible: boolean;
  locked: boolean;
  
  // スタイル
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  
  // メタデータ
  createdAt: number;
  updatedAt: number;
  parentId?: string;
  children?: string[];
  
  // 拡張可能なプロパティ
  props: Record<string, any>;
}
```

### 具体的なShape型

```typescript
interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
  cornerRadius?: number;
}

interface EllipseShape extends BaseShape {
  type: 'ellipse';
  width: number;
  height: number;
}

interface LineShape extends BaseShape {
  type: 'line';
  points: Point[];
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  autoSize: boolean;
  width?: number;
  height?: number;
}

interface FreehandShape extends BaseShape {
  type: 'freehand';
  points: Point[];
  pressure?: number[];
  smoothing?: number;
}

type Shape = RectangleShape | EllipseShape | LineShape | TextShape | FreehandShape;
type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'text' | 'freehand';
```

### Shape作成オプション

```typescript
interface CreateShapeOptions {
  type: ShapeType;
  x: number;
  y: number;
  
  // 型固有のプロパティ
  width?: number;
  height?: number;
  text?: string;
  points?: Point[];
  
  // オプショナルプロパティ
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
  
  // その他
  props?: Record<string, any>;
}
```

## 🎯 Tools API

### Tool Interface

```typescript
interface Tool {
  id: string;
  name: string;
  cursor?: string;
  
  // ライフサイクル
  onActivate(engine: WhiteboardEngine): void;
  onDeactivate(engine: WhiteboardEngine): void;
  
  // イベントハンドラ
  onPointerDown(event: PointerEvent, engine: WhiteboardEngine): void;
  onPointerMove(event: PointerEvent, engine: WhiteboardEngine): void;
  onPointerUp(event: PointerEvent, engine: WhiteboardEngine): void;
  onKeyDown?(event: KeyboardEvent, engine: WhiteboardEngine): void;
  onKeyUp?(event: KeyboardEvent, engine: WhiteboardEngine): void;
  onDoubleClick?(event: MouseEvent, engine: WhiteboardEngine): void;
  
  // 状態
  isActive(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
}
```

### 組み込みツール

```typescript
// 選択ツール
class SelectTool implements Tool {
  id = 'select';
  name = 'Select';
  cursor = 'default';
  
  // 実装詳細...
}

// 長方形描画ツール
class RectangleTool implements Tool {
  id = 'rectangle';
  name = 'Rectangle';
  cursor = 'crosshair';
  
  // 実装詳細...
}

// その他のツール
class EllipseTool implements Tool { /* ... */ }
class LineTool implements Tool { /* ... */ }
class PenTool implements Tool { /* ... */ }
class TextTool implements Tool { /* ... */ }
```

### ツール管理

```typescript
class ToolManager {
  registerTool(tool: Tool): void;
  unregisterTool(toolId: string): void;
  setActiveTool(toolId: string): void;
  getActiveTool(): Tool | null;
  getAllTools(): Tool[];
}
```

## 🔄 Events API

### イベント型

```typescript
interface WhiteboardEvent {
  type: string;
  timestamp: number;
  source: 'user' | 'api' | 'system';
  data?: any;
}

// 具体的なイベント型
interface ShapeCreatedEvent extends WhiteboardEvent {
  type: 'shape:created';
  data: {
    shape: Shape;
  };
}

interface ShapeUpdatedEvent extends WhiteboardEvent {
  type: 'shape:updated';
  data: {
    shape: Shape;
    previousState: Partial<Shape>;
  };
}

interface SelectionChangedEvent extends WhiteboardEvent {
  type: 'selection:changed';
  data: {
    selectedIds: string[];
    previousSelectedIds: string[];
  };
}

interface CameraChangedEvent extends WhiteboardEvent {
  type: 'camera:changed';
  data: {
    camera: Camera;
    previousCamera: Camera;
  };
}
```

### イベントハンドリング

```typescript
// イベントリスナー登録
engine.on('shape:created', (event: ShapeCreatedEvent) => {
  console.log('New shape created:', event.data.shape);
});

engine.on('selection:changed', (event: SelectionChangedEvent) => {
  console.log('Selection changed:', event.data.selectedIds);
});

// 複数イベントの監視
engine.on(['shape:created', 'shape:updated', 'shape:deleted'], (event) => {
  console.log('Shape changed:', event);
});

// イベントの削除
const handler = (event) => { /* ... */ };
engine.on('camera:changed', handler);
engine.off('camera:changed', handler);
```

## 🌍 State Management

### WhiteboardState

```typescript
interface WhiteboardState {
  // Shape管理
  shapes: Record<string, Shape>;
  shapeIds: string[];
  
  // 選択状態
  selectedShapeIds: string[];
  hoveredShapeId: string | null;
  
  // カメラ・ビューポート
  camera: Camera;
  viewport: Viewport;
  
  // ツール状態
  currentTool: string;
  toolState: Record<string, any>;
  
  // UI状態
  gridVisible: boolean;
  snapToGrid: boolean;
  
  // 履歴
  history: HistoryEntry[];
  historyIndex: number;
  
  // メタデータ
  version: string;
  lastModified: number;
}
```

### Camera & Viewport

```typescript
interface Camera {
  x: number;     // カメラ位置X
  y: number;     // カメラ位置Y
  zoom: number;  // ズーム倍率
}

interface Viewport {
  width: number;
  height: number;
  bounds: Bounds;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
```

## ✋ Utility Types

### 基本型

```typescript
interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}
```

### ユーティリティ関数

```typescript
// 座標変換
function worldToScreen(point: Point, camera: Camera, viewport: Viewport): Point;
function screenToWorld(point: Point, camera: Camera, viewport: Viewport): Point;

// 幾何学計算
function pointInBounds(point: Point, bounds: Rectangle): boolean;
function boundsIntersect(a: Rectangle, b: Rectangle): boolean;
function rotateBounds(bounds: Rectangle, rotation: number): Rectangle;

// Shape操作
function getShapeBounds(shape: Shape): Rectangle;
function isShapeSelected(shape: Shape, selectedIds: string[]): boolean;
function cloneShape(shape: Shape): Shape;
```

## 🚀 使用例

### 基本的な使用例

```typescript
import { WhiteboardEngine, SelectTool, RectangleTool } from 'dom-wb-handson';

// エンジンの初期化
const engine = new WhiteboardEngine({
  container: document.getElementById('whiteboard')!,
  width: 800,
  height: 600,
  showGrid: true,
  gridSize: 20,
});

// ツールの登録
engine.toolManager.registerTool(new SelectTool());
engine.toolManager.registerTool(new RectangleTool());

// 初期シェイプの追加
const rectangle = engine.addShape({
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  fill: '#3b82f6',
  stroke: '#1e40af',
  strokeWidth: 2,
});

// イベントの監視
engine.on('shape:created', (event) => {
  console.log('Created shape:', event.data.shape.id);
});

// ツールの切り替え
engine.toolManager.setActiveTool('rectangle');
```

### 高度な使用例

```typescript
// カスタムツールの作成
class CustomTool implements Tool {
  id = 'custom';
  name = 'Custom Tool';
  
  onActivate(engine: WhiteboardEngine) {
    engine.setProperty('cursor', 'crosshair');
  }
  
  onPointerDown(event: PointerEvent, engine: WhiteboardEngine) {
    const worldPoint = engine.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    // カスタムロジック
    engine.addShape({
      type: 'ellipse',
      x: worldPoint.x,
      y: worldPoint.y,
      width: 50,
      height: 50,
      fill: '#ef4444',
    });
  }
  
  // その他のメソッド実装...
}

// カスタムツールの登録
engine.toolManager.registerTool(new CustomTool());
```

## 📚 型定義ファイル

完全な型定義は以下のファイルで提供されます：

- `types/core.ts` - コア型定義
- `types/shapes.ts` - Shape関連の型
- `types/tools.ts` - ツール関連の型
- `types/events.ts` - イベント関連の型
- `types/utils.ts` - ユーティリティ型

## 🔧 設定オプション

### パフォーマンス設定

```typescript
interface PerformanceOptions {
  enableVirtualization: boolean;  // 大量のShapeの最適化
  maxShapesPerFrame: number;      // 1フレームあたりの最大更新数
  debounceTime: number;           // イベントのデバウンス時間
  useWorker: boolean;             // Web Workerでの計算処理
}
```

### デバッグ設定

```typescript  
interface DebugOptions {
  showBounds: boolean;      // Shape境界の表示
  showHandles: boolean;     // 選択ハンドルの表示
  logEvents: boolean;       // イベントログの出力
  performance: boolean;     // パフォーマンス測定
}
```

---

📖 **関連ドキュメント**
- [アーキテクチャ設計](../architecture/) - システム設計の詳細
- [開発ガイド](../development/) - 開発者向けの詳細情報
- [サンプルコード](../examples/) - 実装例とベストプラクティス