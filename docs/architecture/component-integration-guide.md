# コンポーネント統合ガイド

## 🎯 概要

このガイドは、DOMホワイトボードプロジェクトの新しいコンポーネント（SelectionLayer、ToolManager、Tool）を既存のアーキテクチャに統合するための包括的な指針を提供します。

## 🏗️ コンポーネントアーキテクチャ

### 全体構成図

```
┌─────────────────────────────────────────────────────────┐
│                    WhiteboardCanvas                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  CanvasContainer                  │   │
│  │  ┌───────────────┐  ┌─────────────────────┐    │   │
│  │  │  ShapeLayer   │  │  SelectionLayer    │    │   │
│  │  │               │  │                     │    │   │
│  │  │  ┌─────────┐ │  │  ┌──────────────┐  │    │   │
│  │  │  │ Shape 1 │ │  │  │ Selection Box│  │    │   │
│  │  │  └─────────┘ │  │  └──────────────┘  │    │   │
│  │  │  ┌─────────┐ │  │  ┌──────────────┐  │    │   │
│  │  │  │ Shape 2 │ │  │  │Resize Handles│  │    │   │
│  │  │  └─────────┘ │  │  └──────────────┘  │    │   │
│  │  └───────────────┘  └─────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  ToolManager                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │SelectTool│ │RectTool  │ │ EllipseTool  │   │   │
│  │  └──────────┘ └──────────┘ └──────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │               WhiteboardStore                    │   │
│  │         (shapes, selection, tools)               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 📦 コンポーネント詳細

### 1. SelectionLayer

**責務:**
- 選択されたShapeの視覚的フィードバック
- リサイズハンドルの表示と管理
- 選択ボックスの描画
- 複数選択の視覚化

```typescript
// src/components/SelectionLayer.ts
export interface SelectionLayerProps {
  container: HTMLElement;
  store: WhiteboardStore;
}

export class SelectionLayer {
  private element: HTMLElement;
  private selectionBox: HTMLElement | null = null;
  private resizeHandles: Map<string, HTMLElement> = new Map();
  
  constructor(private props: SelectionLayerProps) {
    this.element = this.createElement();
    this.setupStoreSubscription();
    this.attachToContainer();
  }
  
  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'selection-layer';
    element.setAttribute('data-layer', 'selection');
    element.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `;
    return element;
  }
  
  private setupStoreSubscription(): void {
    // ストアの選択状態を監視
    this.props.store.subscribe(
      state => state.selectedShapeIds,
      selectedIds => this.updateSelection(selectedIds)
    );
  }
  
  private updateSelection(selectedIds: string[]): void {
    this.clearSelection();
    
    if (selectedIds.length === 0) return;
    
    if (selectedIds.length === 1) {
      this.showSingleSelection(selectedIds[0]);
    } else {
      this.showMultipleSelection(selectedIds);
    }
  }
  
  private showSingleSelection(shapeId: string): void {
    const shape = this.props.store.getShape(shapeId);
    if (!shape) return;
    
    // 選択ボックスを作成
    this.selectionBox = this.createSelectionBox(shape);
    this.element.appendChild(this.selectionBox);
    
    // リサイズハンドルを作成
    this.createResizeHandles(shape);
  }
  
  private createSelectionBox(shape: Shape): HTMLElement {
    const box = document.createElement('div');
    box.className = 'selection-box';
    box.setAttribute('data-shape-id', shape.id);
    box.setAttribute('data-selection-type', 'single');
    
    const bounds = this.calculateBounds(shape);
    box.style.cssText = `
      position: absolute;
      left: ${bounds.x}px;
      top: ${bounds.y}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      border: 2px solid #0066ff;
      pointer-events: none;
    `;
    
    return box;
  }
  
  private createResizeHandles(shape: Shape): void {
    const handles = [
      { position: 'nw', cursor: 'nw-resize' },
      { position: 'n', cursor: 'n-resize' },
      { position: 'ne', cursor: 'ne-resize' },
      { position: 'e', cursor: 'e-resize' },
      { position: 'se', cursor: 'se-resize' },
      { position: 's', cursor: 's-resize' },
      { position: 'sw', cursor: 'sw-resize' },
      { position: 'w', cursor: 'w-resize' },
    ];
    
    handles.forEach(({ position, cursor }) => {
      const handle = this.createResizeHandle(shape, position, cursor);
      this.resizeHandles.set(position, handle);
      this.selectionBox!.appendChild(handle);
    });
  }
  
  private createResizeHandle(
    shape: Shape,
    position: string,
    cursor: string
  ): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.setAttribute('data-resize-handle', position);
    handle.setAttribute('data-shape-id', shape.id);
    handle.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      background: white;
      border: 2px solid #0066ff;
      border-radius: 2px;
      cursor: ${cursor};
      pointer-events: auto;
      ${this.getHandlePosition(position)}
    `;
    
    // リサイズイベントの設定
    handle.addEventListener('mousedown', this.handleResizeStart.bind(this));
    
    return handle;
  }
  
  private getHandlePosition(position: string): string {
    const positions: Record<string, string> = {
      'nw': 'top: -5px; left: -5px;',
      'n': 'top: -5px; left: 50%; transform: translateX(-50%);',
      'ne': 'top: -5px; right: -5px;',
      'e': 'top: 50%; right: -5px; transform: translateY(-50%);',
      'se': 'bottom: -5px; right: -5px;',
      's': 'bottom: -5px; left: 50%; transform: translateX(-50%);',
      'sw': 'bottom: -5px; left: -5px;',
      'w': 'top: 50%; left: -5px; transform: translateY(-50%);',
    };
    return positions[position] || '';
  }
  
  private handleResizeStart(event: MouseEvent): void {
    event.stopPropagation();
    const handle = event.target as HTMLElement;
    const position = handle.getAttribute('data-resize-handle')!;
    const shapeId = handle.getAttribute('data-shape-id')!;
    
    // ToolManagerにリサイズモードを通知
    this.props.store.setResizing({
      shapeId,
      handle: position,
      startPoint: { x: event.clientX, y: event.clientY },
    });
  }
  
  private clearSelection(): void {
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
    this.resizeHandles.clear();
  }
  
  destroy(): void {
    this.clearSelection();
    this.element.remove();
  }
}
```

### 2. ToolManager

**責務:**
- 現在のツールの管理
- ツール間の切り替え
- イベントの適切なツールへの委譲
- ツールの登録と削除

```typescript
// src/tools/ToolManager.ts
export interface Tool {
  id: string;
  name: string;
  icon?: string;
  cursor: string;
  
  // ライフサイクル
  onActivate(context: ToolContext): void;
  onDeactivate(): void;
  
  // イベントハンドラ
  onPointerDown?(event: PointerEvent, context: ToolContext): void;
  onPointerMove?(event: PointerEvent, context: ToolContext): void;
  onPointerUp?(event: PointerEvent, context: ToolContext): void;
  onKeyDown?(event: KeyboardEvent, context: ToolContext): void;
  onKeyUp?(event: KeyboardEvent, context: ToolContext): void;
  onDoubleClick?(event: MouseEvent, context: ToolContext): void;
  
  // 状態
  canUndo?(): boolean;
  canRedo?(): boolean;
}

export interface ToolContext {
  store: WhiteboardStore;
  canvas: HTMLElement;
  screenToWorld: (point: Point) => Point;
  worldToScreen: (point: Point) => Point;
  startTransaction: () => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;
}

export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private activeTool: Tool | null = null;
  private context: ToolContext;
  private listeners: Map<string, EventListener> = new Map();
  
  constructor(
    private container: HTMLElement,
    private store: WhiteboardStore
  ) {
    this.context = this.createContext();
    this.setupEventListeners();
    this.registerDefaultTools();
  }
  
  private createContext(): ToolContext {
    return {
      store: this.store,
      canvas: this.container,
      screenToWorld: (point: Point) => this.screenToWorld(point),
      worldToScreen: (point: Point) => this.worldToScreen(point),
      startTransaction: () => this.store.startTransaction(),
      commitTransaction: () => this.store.commitTransaction(),
      cancelTransaction: () => this.store.cancelTransaction(),
    };
  }
  
  private setupEventListeners(): void {
    // ポインターイベント
    this.addListener('pointerdown', (e: PointerEvent) => {
      this.activeTool?.onPointerDown?.(e, this.context);
    });
    
    this.addListener('pointermove', (e: PointerEvent) => {
      this.activeTool?.onPointerMove?.(e, this.context);
    });
    
    this.addListener('pointerup', (e: PointerEvent) => {
      this.activeTool?.onPointerUp?.(e, this.context);
    });
    
    // キーボードイベント
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      this.activeTool?.onKeyDown?.(e, this.context);
    });
    
    document.addEventListener('keyup', (e: KeyboardEvent) => {
      this.activeTool?.onKeyUp?.(e, this.context);
    });
    
    // ダブルクリック
    this.addListener('dblclick', (e: MouseEvent) => {
      this.activeTool?.onDoubleClick?.(e, this.context);
    });
  }
  
  private addListener(event: string, handler: EventListener): void {
    this.container.addEventListener(event, handler);
    this.listeners.set(event, handler);
  }
  
  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
    
    // 最初のツールを自動的にアクティブに
    if (!this.activeTool && this.tools.size === 1) {
      this.setActiveTool(tool.id);
    }
  }
  
  unregisterTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool) return;
    
    if (this.activeTool === tool) {
      this.activeTool.onDeactivate();
      this.activeTool = null;
    }
    
    this.tools.delete(toolId);
  }
  
  setActiveTool(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (!tool || tool === this.activeTool) return;
    
    // 現在のツールを非アクティブ化
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }
    
    // 新しいツールをアクティブ化
    this.activeTool = tool;
    tool.onActivate(this.context);
    
    // カーソルを更新
    this.container.style.cursor = tool.cursor;
    
    // ストアに通知
    this.store.setActiveTool(toolId);
  }
  
  getActiveTool(): Tool | null {
    return this.activeTool;
  }
  
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  // 座標変換ヘルパー
  private screenToWorld(point: Point): Point {
    const rect = this.container.getBoundingClientRect();
    const camera = this.store.getCamera();
    
    return {
      x: (point.x - rect.left - rect.width / 2) / camera.zoom + camera.x,
      y: (point.y - rect.top - rect.height / 2) / camera.zoom + camera.y,
    };
  }
  
  private worldToScreen(point: Point): Point {
    const rect = this.container.getBoundingClientRect();
    const camera = this.store.getCamera();
    
    return {
      x: (point.x - camera.x) * camera.zoom + rect.width / 2 + rect.left,
      y: (point.y - camera.y) * camera.zoom + rect.height / 2 + rect.top,
    };
  }
  
  private registerDefaultTools(): void {
    // デフォルトツールの登録
    this.registerTool(new SelectTool());
    this.registerTool(new RectangleTool());
    this.registerTool(new EllipseTool());
  }
  
  destroy(): void {
    // イベントリスナーの削除
    this.listeners.forEach((handler, event) => {
      this.container.removeEventListener(event, handler);
    });
    this.listeners.clear();
    
    // ツールの非アクティブ化
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }
    
    this.tools.clear();
  }
}
```

### 3. Tool実装例

#### SelectTool

```typescript
// src/tools/SelectTool.ts
export class SelectTool implements Tool {
  id = 'select';
  name = 'Select';
  icon = 'cursor';
  cursor = 'default';
  
  private isDragging = false;
  private dragStart: Point | null = null;
  private selectedShapes: string[] = [];
  
  onActivate(context: ToolContext): void {
    console.log('Select tool activated');
  }
  
  onDeactivate(): void {
    this.isDragging = false;
    this.dragStart = null;
  }
  
  onPointerDown(event: PointerEvent, context: ToolContext): void {
    const worldPoint = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    // Shapeのヒットテスト
    const hitShape = this.findShapeAtPoint(worldPoint, context);
    
    if (hitShape) {
      // Shapeをクリック
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        // 複数選択
        this.toggleShapeSelection(hitShape.id, context);
      } else {
        // 単一選択
        context.store.selectShape(hitShape.id);
        this.selectedShapes = [hitShape.id];
      }
      
      // ドラッグ開始
      this.isDragging = true;
      this.dragStart = worldPoint;
    } else {
      // 空白領域をクリック
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        context.store.clearSelection();
        this.selectedShapes = [];
      }
    }
  }
  
  onPointerMove(event: PointerEvent, context: ToolContext): void {
    if (!this.isDragging || !this.dragStart) return;
    
    const worldPoint = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    const deltaX = worldPoint.x - this.dragStart.x;
    const deltaY = worldPoint.y - this.dragStart.y;
    
    // 選択されたShapeを移動
    context.startTransaction();
    
    this.selectedShapes.forEach(shapeId => {
      const shape = context.store.getShape(shapeId);
      if (shape) {
        context.store.updateShape(shapeId, {
          x: shape.x + deltaX,
          y: shape.y + deltaY,
        });
      }
    });
    
    context.commitTransaction();
    
    this.dragStart = worldPoint;
  }
  
  onPointerUp(event: PointerEvent, context: ToolContext): void {
    this.isDragging = false;
    this.dragStart = null;
  }
  
  onKeyDown(event: KeyboardEvent, context: ToolContext): void {
    // Delete/Backspace: 選択されたShapeを削除
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedIds = context.store.getSelectedShapeIds();
      if (selectedIds.length > 0) {
        context.startTransaction();
        selectedIds.forEach(id => context.store.removeShape(id));
        context.commitTransaction();
      }
    }
    
    // Ctrl/Cmd + A: 全選択
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      const allShapeIds = context.store.getAllShapes().map(s => s.id);
      context.store.selectMultipleShapes(allShapeIds);
    }
    
    // Escape: 選択解除
    if (event.key === 'Escape') {
      context.store.clearSelection();
    }
  }
  
  private findShapeAtPoint(point: Point, context: ToolContext): Shape | null {
    const shapes = context.store.getAllShapes();
    
    // 後ろから前へ（上から下へ）検索
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (this.isPointInShape(point, shape)) {
        return shape;
      }
    }
    
    return null;
  }
  
  private isPointInShape(point: Point, shape: Shape): boolean {
    // 簡単な矩形判定（実際は各Shapeタイプに応じた判定が必要）
    return (
      point.x >= shape.x &&
      point.x <= shape.x + shape.width &&
      point.y >= shape.y &&
      point.y <= shape.y + shape.height
    );
  }
  
  private toggleShapeSelection(shapeId: string, context: ToolContext): void {
    const selectedIds = context.store.getSelectedShapeIds();
    
    if (selectedIds.includes(shapeId)) {
      // 選択解除
      const newSelection = selectedIds.filter(id => id !== shapeId);
      context.store.selectMultipleShapes(newSelection);
    } else {
      // 選択追加
      context.store.selectMultipleShapes([...selectedIds, shapeId]);
    }
    
    this.selectedShapes = context.store.getSelectedShapeIds();
  }
}
```

#### RectangleTool

```typescript
// src/tools/RectangleTool.ts
export class RectangleTool implements Tool {
  id = 'rectangle';
  name = 'Rectangle';
  icon = 'square';
  cursor = 'crosshair';
  
  private isDrawing = false;
  private startPoint: Point | null = null;
  private previewElement: HTMLElement | null = null;
  private currentShapeId: string | null = null;
  
  onActivate(context: ToolContext): void {
    console.log('Rectangle tool activated');
  }
  
  onDeactivate(): void {
    this.cancelDrawing();
  }
  
  onPointerDown(event: PointerEvent, context: ToolContext): void {
    if (event.button !== 0) return; // 左クリックのみ
    
    this.startPoint = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    this.isDrawing = true;
    
    // プレビュー要素を作成
    this.createPreview(context);
  }
  
  onPointerMove(event: PointerEvent, context: ToolContext): void {
    if (!this.isDrawing || !this.startPoint || !this.previewElement) return;
    
    const currentPoint = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    // プレビューを更新
    this.updatePreview(this.startPoint, currentPoint, context);
  }
  
  onPointerUp(event: PointerEvent, context: ToolContext): void {
    if (!this.isDrawing || !this.startPoint) return;
    
    const endPoint = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    // 最小サイズチェック
    const width = Math.abs(endPoint.x - this.startPoint.x);
    const height = Math.abs(endPoint.y - this.startPoint.y);
    
    if (width >= 5 && height >= 5) {
      // Shapeを作成
      context.startTransaction();
      
      const shape = context.store.addShape({
        type: 'rectangle',
        x: Math.min(this.startPoint.x, endPoint.x),
        y: Math.min(this.startPoint.y, endPoint.y),
        width,
        height,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1,
      });
      
      // 作成したShapeを選択
      context.store.clearSelection();
      context.store.selectShape(shape.id);
      
      context.commitTransaction();
    }
    
    this.cancelDrawing();
  }
  
  onKeyDown(event: KeyboardEvent, context: ToolContext): void {
    // Escape: 描画キャンセル
    if (event.key === 'Escape') {
      this.cancelDrawing();
    }
  }
  
  private createPreview(context: ToolContext): void {
    this.previewElement = document.createElement('div');
    this.previewElement.className = 'shape-preview rectangle-preview';
    this.previewElement.style.cssText = `
      position: absolute;
      border: 2px dashed #0066ff;
      background: rgba(0, 102, 255, 0.1);
      pointer-events: none;
      z-index: 999;
    `;
    
    const shapeLayer = context.canvas.querySelector('.shape-layer');
    if (shapeLayer) {
      shapeLayer.appendChild(this.previewElement);
    }
  }
  
  private updatePreview(
    start: Point,
    current: Point,
    context: ToolContext
  ): void {
    if (!this.previewElement) return;
    
    const screenStart = context.worldToScreen(start);
    const screenCurrent = context.worldToScreen(current);
    
    const x = Math.min(screenStart.x, screenCurrent.x);
    const y = Math.min(screenStart.y, screenCurrent.y);
    const width = Math.abs(screenCurrent.x - screenStart.x);
    const height = Math.abs(screenCurrent.y - screenStart.y);
    
    // キャンバスの境界を取得
    const rect = context.canvas.getBoundingClientRect();
    
    this.previewElement.style.left = `${x - rect.left}px`;
    this.previewElement.style.top = `${y - rect.top}px`;
    this.previewElement.style.width = `${width}px`;
    this.previewElement.style.height = `${height}px`;
  }
  
  private cancelDrawing(): void {
    this.isDrawing = false;
    this.startPoint = null;
    
    if (this.previewElement) {
      this.previewElement.remove();
      this.previewElement = null;
    }
  }
}
```

## 🔌 統合手順

### 1. 依存関係の注入

```typescript
// src/WhiteboardCanvas.ts
export class WhiteboardCanvas {
  private container: HTMLElement;
  private store: WhiteboardStore;
  private shapeLayer: HTMLElement;
  private selectionLayer: SelectionLayer;
  private toolManager: ToolManager;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.store = useWhiteboardStore;
    
    this.initializeCanvas();
    this.initializeComponents();
    this.setupEventHandlers();
  }
  
  private initializeCanvas(): void {
    // キャンバスコンテナの設定
    this.container.className = 'whiteboard-canvas';
    this.container.setAttribute('data-canvas-ready', 'true');
    this.container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #f5f5f5;
    `;
    
    // Shapeレイヤーの作成
    this.shapeLayer = document.createElement('div');
    this.shapeLayer.className = 'shape-layer';
    this.shapeLayer.setAttribute('data-layer', 'shapes');
    this.shapeLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;
    this.container.appendChild(this.shapeLayer);
  }
  
  private initializeComponents(): void {
    // SelectionLayerの初期化
    this.selectionLayer = new SelectionLayer({
      container: this.container,
      store: this.store,
    });
    
    // ToolManagerの初期化
    this.toolManager = new ToolManager(this.container, this.store);
    
    // カスタムツールの登録
    this.registerCustomTools();
  }
  
  private registerCustomTools(): void {
    // 必要に応じてカスタムツールを登録
    // this.toolManager.registerTool(new CustomTool());
  }
  
  private setupEventHandlers(): void {
    // ストアの変更を監視
    this.store.subscribe(
      state => state.shapes,
      shapes => this.renderShapes(shapes)
    );
    
    // キーボードショートカット
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    // ツール切り替えショートカット
    const shortcuts: Record<string, string> = {
      'v': 'select',      // V: Select tool
      'r': 'rectangle',   // R: Rectangle tool
      'e': 'ellipse',     // E: Ellipse tool
    };
    
    const toolId = shortcuts[event.key.toLowerCase()];
    if (toolId && !event.ctrlKey && !event.metaKey) {
      this.toolManager.setActiveTool(toolId);
    }
  }
  
  private renderShapes(shapes: Shape[]): void {
    // 既存のShapeをクリア
    this.shapeLayer.innerHTML = '';
    
    // Shapeを再描画
    shapes.forEach(shape => {
      const element = this.createShapeElement(shape);
      this.shapeLayer.appendChild(element);
    });
  }
  
  private createShapeElement(shape: Shape): HTMLElement {
    const element = document.createElement('div');
    element.className = `shape shape-${shape.type}`;
    element.setAttribute('data-shape-id', shape.id);
    element.setAttribute('data-shape-type', shape.type);
    element.setAttribute('data-shape', 'true'); // E2Eテスト互換性のため
    
    // スタイル設定
    element.style.cssText = `
      position: absolute;
      transform: translate(${shape.x}px, ${shape.y}px);
      width: ${shape.width}px;
      height: ${shape.height}px;
      background: ${shape.fillColor};
      border: ${shape.strokeWidth}px solid ${shape.strokeColor};
      opacity: ${shape.opacity};
    `;
    
    // 選択状態の反映
    if (this.store.getSelectedShapeIds().includes(shape.id)) {
      element.setAttribute('data-shape-selected', 'true');
      element.setAttribute('data-selected', 'true'); // E2Eテスト互換性
      element.classList.add('selected');
    }
    
    return element;
  }
  
  // Public API
  setActiveTool(toolId: string): void {
    this.toolManager.setActiveTool(toolId);
  }
  
  getActiveTool(): Tool | null {
    return this.toolManager.getActiveTool();
  }
  
  addCustomTool(tool: Tool): void {
    this.toolManager.registerTool(tool);
  }
  
  destroy(): void {
    this.selectionLayer.destroy();
    this.toolManager.destroy();
    this.container.innerHTML = '';
  }
}
```

### 2. ストアの拡張

```typescript
// src/store.ts
interface ToolState {
  activeTool: string;
  toolOptions: Record<string, any>;
  isResizing: boolean;
  resizeInfo: ResizeInfo | null;
}

interface ResizeInfo {
  shapeId: string;
  handle: string;
  startPoint: Point;
}

interface TransactionState {
  isInTransaction: boolean;
  transactionShapes: Shape[];
}

export interface WhiteboardState {
  shapes: Shape[];
  selectedShapeIds: string[];
  camera: Camera;
  tool: ToolState;
  transaction: TransactionState;
}

export const useWhiteboardStore = create<WhiteboardState & Actions>((set, get) => ({
  // 初期状態
  shapes: [],
  selectedShapeIds: [],
  camera: { x: 0, y: 0, zoom: 1 },
  tool: {
    activeTool: 'select',
    toolOptions: {},
    isResizing: false,
    resizeInfo: null,
  },
  transaction: {
    isInTransaction: false,
    transactionShapes: [],
  },
  
  // アクション
  setActiveTool: (toolId: string) => {
    set(state => ({
      tool: {
        ...state.tool,
        activeTool: toolId,
      },
    }));
  },
  
  setResizing: (resizeInfo: ResizeInfo | null) => {
    set(state => ({
      tool: {
        ...state.tool,
        isResizing: resizeInfo !== null,
        resizeInfo,
      },
    }));
  },
  
  startTransaction: () => {
    const currentShapes = get().shapes;
    set(state => ({
      transaction: {
        isInTransaction: true,
        transactionShapes: [...currentShapes],
      },
    }));
  },
  
  commitTransaction: () => {
    set(state => ({
      transaction: {
        isInTransaction: false,
        transactionShapes: [],
      },
    }));
    
    // ここでUndo/Redoスタックに追加
  },
  
  cancelTransaction: () => {
    const { transactionShapes } = get().transaction;
    set(state => ({
      shapes: transactionShapes,
      transaction: {
        isInTransaction: false,
        transactionShapes: [],
      },
    }));
  },
  
  // 既存のアクション...
}));
```

## 🧪 テスト戦略

### ユニットテスト

```typescript
// tests/SelectionLayer.test.ts
describe('SelectionLayer', () => {
  it('should show selection box for single shape', () => {
    const container = document.createElement('div');
    const store = createMockStore({
      shapes: [createMockShape('shape-1')],
      selectedShapeIds: ['shape-1'],
    });
    
    const selectionLayer = new SelectionLayer({ container, store });
    
    const selectionBox = container.querySelector('.selection-box');
    expect(selectionBox).toBeTruthy();
    expect(selectionBox?.getAttribute('data-shape-id')).toBe('shape-1');
  });
  
  it('should show resize handles', () => {
    const container = document.createElement('div');
    const store = createMockStore({
      shapes: [createMockShape('shape-1')],
      selectedShapeIds: ['shape-1'],
    });
    
    const selectionLayer = new SelectionLayer({ container, store });
    
    const handles = container.querySelectorAll('.resize-handle');
    expect(handles.length).toBe(8);
  });
});
```

### 統合テスト

```typescript
// tests/integration/ToolManager.test.ts
describe('ToolManager Integration', () => {
  it('should switch between tools', () => {
    const canvas = new WhiteboardCanvas(container);
    
    canvas.setActiveTool('rectangle');
    expect(canvas.getActiveTool()?.id).toBe('rectangle');
    
    canvas.setActiveTool('select');
    expect(canvas.getActiveTool()?.id).toBe('select');
  });
  
  it('should create shape with rectangle tool', async () => {
    const canvas = new WhiteboardCanvas(container);
    canvas.setActiveTool('rectangle');
    
    // ドラッグで矩形を描画
    await simulateDrag(container, { x: 100, y: 100 }, { x: 200, y: 200 });
    
    const shapes = store.getState().shapes;
    expect(shapes).toHaveLength(1);
    expect(shapes[0].type).toBe('rectangle');
  });
});
```

## 📊 パフォーマンス考慮事項

### 1. イベントデバウンス

```typescript
class DebouncedToolManager extends ToolManager {
  private moveDebounceTimer?: number;
  
  protected handlePointerMove(event: PointerEvent): void {
    if (this.moveDebounceTimer) {
      cancelAnimationFrame(this.moveDebounceTimer);
    }
    
    this.moveDebounceTimer = requestAnimationFrame(() => {
      super.handlePointerMove(event);
    });
  }
}
```

### 2. 選択レイヤーの最適化

```typescript
class OptimizedSelectionLayer extends SelectionLayer {
  private updateScheduled = false;
  
  protected scheduleUpdate(): void {
    if (this.updateScheduled) return;
    
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateSelection();
      this.updateScheduled = false;
    });
  }
}
```

## ✅ チェックリスト

### 実装時の確認事項

- [ ] 各コンポーネントが独立してテスト可能
- [ ] イベントリスナーが適切にクリーンアップされる
- [ ] データ属性が一貫して設定される
- [ ] E2Eテストとの互換性が保たれる
- [ ] パフォーマンスが最適化されている

### 統合時の確認事項

- [ ] ツール切り替えが正しく動作する
- [ ] 選択状態が視覚的に反映される
- [ ] リサイズハンドルが正しく表示される
- [ ] ストアの状態が同期される
- [ ] メモリリークがない

これらのガイドラインに従うことで、新しいコンポーネントをスムーズに統合できます。