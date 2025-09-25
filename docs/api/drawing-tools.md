# フェーズ1: 描画ツールAPI仕様書

フェーズ1で実装される描画ツール（長方形、楕円、直線）のAPI仕様とリサイズ機能について詳細に説明します。

## 🎨 描画ツール概要

フェーズ1では以下の描画ツールが実装されます：

- **RectangleTool** - 長方形描画ツール
- **EllipseTool** - 楕円描画ツール  
- **LineTool** - 直線描画ツール
- **ResizeTool** - リサイズハンドルツール

## 🏗️ 描画ツールアーキテクチャ

### Tool基底クラス

```typescript
abstract class DrawingTool implements Tool {
  protected isDrawing = false;
  protected startPoint: Point | null = null;
  protected currentShape: Shape | null = null;
  protected previewElement: HTMLElement | null = null;
  
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly cursor: string;
  
  // ライフサイクル
  onActivate(engine: WhiteboardEngine): void {
    engine.getContainer().style.cursor = this.cursor;
  }
  
  onDeactivate(engine: WhiteboardEngine): void {
    this.cleanup();
    engine.getContainer().style.cursor = 'default';
  }
  
  // 抽象メソッド
  abstract createShape(startPoint: Point, endPoint: Point): CreateShapeOptions;
  abstract updatePreview(startPoint: Point, currentPoint: Point): void;
  
  // 共通描画フロー
  onPointerDown(event: PointerEvent, engine: WhiteboardEngine): void {
    if (event.button !== 0) return; // 左クリックのみ
    
    this.startPoint = engine.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    this.isDrawing = true;
    this.createPreviewElement(engine);
    
    // Escapeキーでキャンセル
    document.addEventListener('keydown', this.handleKeyDown);
  }
  
  onPointerMove(event: PointerEvent, engine: WhiteboardEngine): void {
    if (!this.isDrawing || !this.startPoint) return;
    
    const currentPoint = engine.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    this.updatePreview(this.startPoint, currentPoint);
  }
  
  onPointerUp(event: PointerEvent, engine: WhiteboardEngine): void {
    if (!this.isDrawing || !this.startPoint) return;
    
    const endPoint = engine.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    // 最小サイズチェック
    if (this.isValidSize(this.startPoint, endPoint)) {
      const shapeOptions = this.createShape(this.startPoint, endPoint);
      const shape = engine.addShape(shapeOptions);
      
      // 作成されたShapeを選択
      engine.clearSelection();
      engine.selectShape(shape.id);
    }
    
    this.cleanup();
  }
  
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.cleanup();
    }
  };
  
  private isValidSize(start: Point, end: Point): boolean {
    const MIN_SIZE = 5;
    return Math.abs(end.x - start.x) >= MIN_SIZE || 
           Math.abs(end.y - start.y) >= MIN_SIZE;
  }
  
  private cleanup(): void {
    this.isDrawing = false;
    this.startPoint = null;
    this.currentShape = null;
    
    if (this.previewElement) {
      this.previewElement.remove();
      this.previewElement = null;
    }
    
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}
```

## 📐 RectangleTool (長方形描画)

### API仕様

```typescript
class RectangleTool extends DrawingTool {
  readonly id = 'rectangle';
  readonly name = 'Rectangle';
  readonly cursor = 'crosshair';
  
  createShape(startPoint: Point, endPoint: Point): CreateShapeOptions {
    const bounds = this.calculateBounds(startPoint, endPoint);
    
    return {
      type: 'rectangle',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fill: this.getDefaultFill(),
      stroke: this.getDefaultStroke(),
      strokeWidth: this.getDefaultStrokeWidth(),
      cornerRadius: this.getDefaultCornerRadius(),
    };
  }
  
  updatePreview(startPoint: Point, currentPoint: Point): void {
    if (!this.previewElement) return;
    
    const bounds = this.calculateBounds(startPoint, currentPoint);
    const style = this.previewElement.style;
    
    style.left = bounds.x + 'px';
    style.top = bounds.y + 'px';
    style.width = bounds.width + 'px';
    style.height = bounds.height + 'px';
  }
  
  private calculateBounds(start: Point, end: Point): Rectangle {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }
  
  // デフォルト設定（オーバーライド可能）
  protected getDefaultFill(): string {
    return 'rgba(59, 130, 246, 0.1)';
  }
  
  protected getDefaultStroke(): string {
    return '#3b82f6';
  }
  
  protected getDefaultStrokeWidth(): number {
    return 2;
  }
  
  protected getDefaultCornerRadius(): number {
    return 4;
  }
}
```

### 設定オプション

```typescript
interface RectangleToolOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  maintainAspectRatio?: boolean; // Shiftキー押下時の正方形描画
  snapToGrid?: boolean;
}

// 使用例
const rectangleTool = new RectangleTool({
  fill: 'rgba(16, 185, 129, 0.2)',
  stroke: '#10b981',
  strokeWidth: 3,
  cornerRadius: 8,
  maintainAspectRatio: true,
});
```

### 拡張機能

```typescript
// アスペクト比維持機能
onPointerMove(event: PointerEvent, engine: WhiteboardEngine): void {
  if (!this.isDrawing || !this.startPoint) return;
  
  let currentPoint = engine.screenToWorld({
    x: event.clientX,
    y: event.clientY,
  });
  
  // Shiftキー押下時は正方形に
  if (event.shiftKey) {
    currentPoint = this.makeSquare(this.startPoint, currentPoint);
  }
  
  this.updatePreview(this.startPoint, currentPoint);
}

private makeSquare(start: Point, current: Point): Point {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  const size = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  
  return {
    x: start.x + (deltaX >= 0 ? size : -size),
    y: start.y + (deltaY >= 0 ? size : -size),
  };
}
```

## ⭕ EllipseTool (楕円描画)

### API仕様

```typescript
class EllipseTool extends DrawingTool {
  readonly id = 'ellipse';
  readonly name = 'Ellipse';
  readonly cursor = 'crosshair';
  
  createShape(startPoint: Point, endPoint: Point): CreateShapeOptions {
    const bounds = this.calculateBounds(startPoint, endPoint);
    
    return {
      type: 'ellipse',
      x: bounds.x + bounds.width / 2,  // 中心座標
      y: bounds.y + bounds.height / 2, // 中心座標
      width: bounds.width,
      height: bounds.height,
      fill: this.getDefaultFill(),
      stroke: this.getDefaultStroke(),
      strokeWidth: this.getDefaultStrokeWidth(),
    };
  }
  
  updatePreview(startPoint: Point, currentPoint: Point): void {
    if (!this.previewElement) return;
    
    const bounds = this.calculateBounds(startPoint, currentPoint);
    const style = this.previewElement.style;
    
    style.left = bounds.x + 'px';
    style.top = bounds.y + 'px';
    style.width = bounds.width + 'px';
    style.height = bounds.height + 'px';
    style.borderRadius = '50%';
  }
  
  protected createPreviewElement(engine: WhiteboardEngine): void {
    super.createPreviewElement(engine);
    if (this.previewElement) {
      this.previewElement.style.borderRadius = '50%';
    }
  }
}
```

### 楕円特有の機能

```typescript
// 完全な円の描画（Shiftキー）
private makeCircle(start: Point, current: Point): Point {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  return {
    x: start.x + (deltaX >= 0 ? radius : -radius),
    y: start.y + (deltaY >= 0 ? radius : -radius),
  };
}

// 中心からの描画（Altキー）
private drawFromCenter(start: Point, current: Point): Rectangle {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  
  return {
    x: start.x - Math.abs(deltaX),
    y: start.y - Math.abs(deltaY),
    width: Math.abs(deltaX) * 2,
    height: Math.abs(deltaY) * 2,
  };
}
```

## 📏 LineTool (直線描画)

### API仕様

```typescript
class LineTool extends DrawingTool {
  readonly id = 'line';
  readonly name = 'Line';
  readonly cursor = 'crosshair';
  
  createShape(startPoint: Point, endPoint: Point): CreateShapeOptions {
    return {
      type: 'line',
      x: startPoint.x,
      y: startPoint.y,
      points: [
        { x: 0, y: 0 }, // 相対座標での開始点
        { 
          x: endPoint.x - startPoint.x, 
          y: endPoint.y - startPoint.y 
        }, // 相対座標での終了点
      ],
      stroke: this.getDefaultStroke(),
      strokeWidth: this.getDefaultStrokeWidth(),
      arrowStart: this.getDefaultArrowStart(),
      arrowEnd: this.getDefaultArrowEnd(),
    };
  }
  
  updatePreview(startPoint: Point, currentPoint: Point): void {
    if (!this.previewElement) return;
    
    const deltaX = currentPoint.x - startPoint.x;
    const deltaY = currentPoint.y - startPoint.y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);
    
    const style = this.previewElement.style;
    style.left = startPoint.x + 'px';
    style.top = startPoint.y + 'px';
    style.width = length + 'px';
    style.height = this.getDefaultStrokeWidth() + 'px';
    style.transform = `rotate(${angle}rad)`;
    style.transformOrigin = '0 50%';
  }
  
  protected getDefaultArrowStart(): boolean {
    return false;
  }
  
  protected getDefaultArrowEnd(): boolean {
    return false;
  }
}
```

### 直線特有の機能

```typescript
// 角度制約（Shiftキー：15度刻み）
private constrainAngle(start: Point, current: Point): Point {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  const angle = Math.atan2(deltaY, deltaX);
  
  // 15度（π/12ラジアン）刻みに制約
  const constrainedAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  return {
    x: start.x + Math.cos(constrainedAngle) * length,
    y: start.y + Math.sin(constrainedAngle) * length,
  };
}

// 矢印の設定
interface LineToolOptions extends DrawingToolOptions {
  arrowStart?: boolean;
  arrowEnd?: boolean;
  arrowSize?: number;
  arrowAngle?: number; // ラジアン
}
```

## 🔧 ResizeTool (リサイズ機能)

### リサイズハンドルシステム

```typescript
class ResizeTool {
  private handles: ResizeHandle[] = [];
  private activeHandle: ResizeHandle | null = null;
  
  // ハンドルの種類
  enum HandleType {
    TopLeft = 'top-left',
    TopRight = 'top-right',
    BottomLeft = 'bottom-left',
    BottomRight = 'bottom-right',
    Top = 'top',
    Right = 'right',
    Bottom = 'bottom',
    Left = 'left',
  }
  
  showHandles(shape: Shape, engine: WhiteboardEngine): void {
    this.hideHandles();
    
    const bounds = shape.getBounds();
    const handles = this.createHandles(bounds);
    
    handles.forEach(handle => {
      const element = this.createHandleElement(handle);
      engine.getContainer().appendChild(element);
      this.handles.push(handle);
    });
  }
  
  private createHandles(bounds: Rectangle): ResizeHandle[] {
    const { x, y, width, height } = bounds;
    
    return [
      // コーナーハンドル
      { type: HandleType.TopLeft, x, y, cursor: 'nw-resize' },
      { type: HandleType.TopRight, x: x + width, y, cursor: 'ne-resize' },
      { type: HandleType.BottomLeft, x, y: y + height, cursor: 'sw-resize' },
      { type: HandleType.BottomRight, x: x + width, y: y + height, cursor: 'se-resize' },
      
      // エッジハンドル
      { type: HandleType.Top, x: x + width / 2, y, cursor: 'n-resize' },
      { type: HandleType.Right, x: x + width, y: y + height / 2, cursor: 'e-resize' },
      { type: HandleType.Bottom, x: x + width / 2, y: y + height, cursor: 's-resize' },
      { type: HandleType.Left, x, y: y + height / 2, cursor: 'w-resize' },
    ];
  }
  
  onHandlePointerDown(handle: ResizeHandle, event: PointerEvent): void {
    this.activeHandle = handle;
    this.startResize(event);
  }
  
  onPointerMove(event: PointerEvent, engine: WhiteboardEngine): void {
    if (!this.activeHandle || !this.selectedShape) return;
    
    const currentPoint = engine.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    const newBounds = this.calculateNewBounds(
      this.selectedShape.getBounds(),
      this.activeHandle,
      currentPoint,
      event.shiftKey // アスペクト比維持
    );
    
    // Shape更新
    this.updateShapeFromBounds(this.selectedShape, newBounds);
    
    // ハンドル位置更新
    this.updateHandlePositions(newBounds);
  }
  
  private calculateNewBounds(
    originalBounds: Rectangle,
    handle: ResizeHandle,
    newPoint: Point,
    maintainAspectRatio: boolean
  ): Rectangle {
    let newBounds = { ...originalBounds };
    
    switch (handle.type) {
      case HandleType.TopLeft:
        newBounds.width += newBounds.x - newPoint.x;
        newBounds.height += newBounds.y - newPoint.y;
        newBounds.x = newPoint.x;
        newBounds.y = newPoint.y;
        break;
        
      case HandleType.TopRight:
        newBounds.width = newPoint.x - newBounds.x;
        newBounds.height += newBounds.y - newPoint.y;
        newBounds.y = newPoint.y;
        break;
        
      case HandleType.BottomRight:
        newBounds.width = newPoint.x - newBounds.x;
        newBounds.height = newPoint.y - newBounds.y;
        break;
        
      case HandleType.BottomLeft:
        newBounds.width += newBounds.x - newPoint.x;
        newBounds.height = newPoint.y - newBounds.y;
        newBounds.x = newPoint.x;
        break;
        
      // エッジハンドルの処理
      case HandleType.Top:
        newBounds.height += newBounds.y - newPoint.y;
        newBounds.y = newPoint.y;
        break;
        
      case HandleType.Right:
        newBounds.width = newPoint.x - newBounds.x;
        break;
        
      case HandleType.Bottom:
        newBounds.height = newPoint.y - newBounds.y;
        break;
        
      case HandleType.Left:
        newBounds.width += newBounds.x - newPoint.x;
        newBounds.x = newPoint.x;
        break;
    }
    
    // アスペクト比維持
    if (maintainAspectRatio && this.isCornerHandle(handle.type)) {
      newBounds = this.maintainAspectRatio(originalBounds, newBounds);
    }
    
    // 最小サイズ制約
    newBounds = this.enforceMinSize(newBounds);
    
    return newBounds;
  }
  
  private maintainAspectRatio(original: Rectangle, newBounds: Rectangle): Rectangle {
    const originalRatio = original.width / original.height;
    const newRatio = newBounds.width / newBounds.height;
    
    if (newRatio > originalRatio) {
      // 幅を調整
      newBounds.width = newBounds.height * originalRatio;
    } else {
      // 高さを調整
      newBounds.height = newBounds.width / originalRatio;
    }
    
    return newBounds;
  }
  
  private enforceMinSize(bounds: Rectangle): Rectangle {
    const MIN_SIZE = 10;
    
    return {
      ...bounds,
      width: Math.max(bounds.width, MIN_SIZE),
      height: Math.max(bounds.height, MIN_SIZE),
    };
  }
}

interface ResizeHandle {
  type: HandleType;
  x: number;
  y: number;
  cursor: string;
}
```

## 🎯 統合インターフェース

### ToolManager拡張

```typescript
class ExtendedToolManager extends ToolManager {
  private drawingTools: Map<string, DrawingTool> = new Map();
  private resizeTool: ResizeTool = new ResizeTool();
  
  registerDrawingTool(tool: DrawingTool): void {
    this.drawingTools.set(tool.id, tool);
    this.registerTool(tool);
  }
  
  // 描画ツール特有の設定
  setDrawingToolOptions(toolId: string, options: DrawingToolOptions): void {
    const tool = this.drawingTools.get(toolId);
    if (tool) {
      tool.setOptions(options);
    }
  }
  
  // 全描画ツールの共通設定
  setGlobalDrawingOptions(options: GlobalDrawingOptions): void {
    this.drawingTools.forEach(tool => {
      tool.setGlobalOptions(options);
    });
  }
}

interface DrawingToolOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

interface GlobalDrawingOptions extends DrawingToolOptions {
  snapToGrid?: boolean;
  maintainAspectRatio?: boolean;
  showPreview?: boolean;
}
```

### イベントシステム拡張

```typescript
// 描画ツール固有のイベント
interface ShapeDrawingStartedEvent extends WhiteboardEvent {
  type: 'shape:drawing-started';
  data: {
    toolId: string;
    startPoint: Point;
  };
}

interface ShapeDrawingEvent extends WhiteboardEvent {
  type: 'shape:drawing';
  data: {
    toolId: string;
    startPoint: Point;
    currentPoint: Point;
    previewBounds: Rectangle;
  };
}

interface ShapeDrawnEvent extends WhiteboardEvent {
  type: 'shape:drawn';
  data: {
    toolId: string;
    shape: Shape;
    bounds: Rectangle;
  };
}

interface ShapeResizeStartedEvent extends WhiteboardEvent {
  type: 'shape:resize-started';
  data: {
    shape: Shape;
    handle: HandleType;
    originalBounds: Rectangle;
  };
}

interface ShapeResizedEvent extends WhiteboardEvent {
  type: 'shape:resized';
  data: {
    shape: Shape;
    originalBounds: Rectangle;
    newBounds: Rectangle;
  };
}
```

## 🔧 設定とカスタマイズ

### デフォルト設定

```typescript
const DEFAULT_DRAWING_CONFIG = {
  rectangle: {
    fill: 'rgba(59, 130, 246, 0.1)',
    stroke: '#3b82f6',
    strokeWidth: 2,
    cornerRadius: 4,
  },
  ellipse: {
    fill: 'rgba(16, 185, 129, 0.1)',
    stroke: '#10b981',
    strokeWidth: 2,
  },
  line: {
    stroke: '#64748b',
    strokeWidth: 2,
    arrowStart: false,
    arrowEnd: false,
  },
  resize: {
    handleSize: 8,
    handleColor: '#3b82f6',
    handleBorderColor: '#ffffff',
    minShapeSize: 10,
    snapThreshold: 5,
  },
};
```

### 使用例

```typescript
import { 
  WhiteboardEngine, 
  RectangleTool, 
  EllipseTool, 
  LineTool 
} from 'dom-wb-handson';

// エンジン初期化
const engine = new WhiteboardEngine({
  container: document.getElementById('canvas')!,
});

// 描画ツールの登録
const rectangleTool = new RectangleTool({
  fill: '#ff6b6b',
  stroke: '#ee5a52',
  strokeWidth: 3,
});

const ellipseTool = new EllipseTool({
  fill: '#4ecdc4',
  stroke: '#45b7aa',
});

const lineTool = new LineTool({
  stroke: '#45b7aa',
  strokeWidth: 3,
  arrowEnd: true,
});

engine.toolManager.registerDrawingTool(rectangleTool);
engine.toolManager.registerDrawingTool(ellipseTool);
engine.toolManager.registerDrawingTool(lineTool);

// ツール切り替え
document.getElementById('rect-btn')?.addEventListener('click', () => {
  engine.toolManager.setCurrentTool('rectangle');
});

document.getElementById('ellipse-btn')?.addEventListener('click', () => {
  engine.toolManager.setCurrentTool('ellipse');
});

document.getElementById('line-btn')?.addEventListener('click', () => {
  engine.toolManager.setCurrentTool('line');
});

// イベント監視
engine.on('shape:drawn', (event) => {
  console.log(`${event.data.toolId} shape created:`, event.data.shape);
});

engine.on('shape:resized', (event) => {
  console.log('Shape resized:', event.data);
});
```

---

📖 **関連ドキュメント**
- [API仕様書](./README.md) - 基本API仕様
- [Undo/Redoシステム](./undo-redo.md) - 履歴管理システム
- [フェーズ2機能](./phase2-features.md) - 高度な機能の仕様