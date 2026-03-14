# サンプルコード・使用例

DOMホワイトボードライブラリの実用的な使用例とベストプラクティスを紹介します。

## 🚀 基本的な使用例

### 最小構成のホワイトボード

```typescript
import { WhiteboardEngine } from 'dom-wb-handson';

// HTMLコンテナを用意
const container = document.getElementById('whiteboard-container')!;

// エンジンを初期化
const engine = new WhiteboardEngine({
  container,
  width: 800,
  height: 600,
});

// 基本的なShapeを追加
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

console.log('Created shape:', rectangle.id);
```

### HTMLマークアップ

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DOM Whiteboard Basic Example</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: sans-serif;
    }
    
    #whiteboard-container {
      width: 800px;
      height: 600px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      position: relative;
      overflow: hidden;
    }
    
    /* ホワイトボード内のShape要素のスタイル */
    .wb-shape {
      position: absolute;
      pointer-events: auto;
      user-select: none;
    }
    
    .wb-shape--rectangle {
      border: 2px solid;
      background: currentColor;
      opacity: 0.7;
    }
    
    .wb-shape--selected {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
  </style>
</head>
<body>
  <h1>DOM Whiteboard Basic Example</h1>
  
  <div id="toolbar">
    <button id="tool-select">選択</button>
    <button id="tool-rectangle">長方形</button>
    <button id="zoom-in">ズームイン</button>
    <button id="zoom-out">ズームアウト</button>
  </div>
  
  <div id="whiteboard-container"></div>
  
  <script type="module" src="./basic.js"></script>
</body>
</html>
```

## 🎨 フェーズ0機能のデモ

### ズーム・パン機能

```typescript
import { WhiteboardEngine } from 'dom-wb-handson';

class ZoomPanDemo {
  private engine: WhiteboardEngine;
  
  constructor(container: HTMLElement) {
    this.engine = new WhiteboardEngine({
      container,
      width: 800,
      height: 600,
      minZoom: 0.1,
      maxZoom: 5.0,
      showGrid: true,
      gridSize: 20,
    });
    
    this.setupControls();
    this.addSampleShapes();
  }
  
  private setupControls(): void {
    // ズームコントロール
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      this.engine.zoomIn();
    });
    
    document.getElementById('zoom-out')?.addEventListener('click', () => {
      this.engine.zoomOut();
    });
    
    // カメラリセット
    document.getElementById('reset-camera')?.addEventListener('click', () => {
      this.engine.setCamera({ x: 0, y: 0, zoom: 1 });
    });
    
    // パン操作の状態表示
    this.engine.on('camera:changed', (event) => {
      const { camera } = event.data;
      this.updateCameraInfo(camera);
    });
  }
  
  private addSampleShapes(): void {
    // グリッド状にサンプルShapeを配置
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        this.engine.addShape({
          type: 'rectangle',
          x: i * 150 + 50,
          y: j * 120 + 50,
          width: 100,
          height: 80,
          fill: `hsl(${(i * j * 50) % 360}, 70%, 60%)`,
          stroke: '#1f2937',
          strokeWidth: 2,
        });
      }
    }
  }
  
  private updateCameraInfo(camera: Camera): void {
    const info = document.getElementById('camera-info');
    if (info) {
      info.innerHTML = `
        X: ${camera.x.toFixed(1)}, 
        Y: ${camera.y.toFixed(1)}, 
        Zoom: ${(camera.zoom * 100).toFixed(0)}%
      `;
    }
  }
}

// 使用例
const container = document.getElementById('whiteboard-container')!;
const demo = new ZoomPanDemo(container);
```

### Shape選択・移動機能

```typescript
import { WhiteboardEngine, SelectTool } from 'dom-wb-handson';

class SelectMoveDemo {
  private engine: WhiteboardEngine;
  
  constructor(container: HTMLElement) {
    this.engine = new WhiteboardEngine({ container });
    this.setupTools();
    this.setupEventHandlers();
    this.addSampleShapes();
  }
  
  private setupTools(): void {
    // 選択ツールを登録・アクティブ化
    const selectTool = new SelectTool();
    this.engine.toolManager.registerTool(selectTool);
    this.engine.toolManager.setActiveTool('select');
  }
  
  private setupEventHandlers(): void {
    // 選択状態の変化を監視
    this.engine.on('selection:changed', (event) => {
      const { selectedIds } = event.data;
      this.updateSelectionInfo(selectedIds);
      this.highlightSelectedShapes(selectedIds);
    });
    
    // Shape移動の監視
    this.engine.on('shape:moved', (event) => {
      const { shape, previousPosition } = event.data;
      console.log(`Shape ${shape.id} moved from`, previousPosition, 'to', {
        x: shape.x,
        y: shape.y
      });
    });
  }
  
  private addSampleShapes(): void {
    // 異なる色・サイズのShapeを追加
    const shapes = [
      { x: 100, y: 100, width: 120, height: 80, fill: '#ef4444' },
      { x: 250, y: 150, width: 100, height: 100, fill: '#10b981' },
      { x: 400, y: 80, width: 150, height: 60, fill: '#3b82f6' },
      { x: 200, y: 300, width: 80, height: 120, fill: '#f59e0b' },
    ];
    
    shapes.forEach((config, index) => {
      this.engine.addShape({
        type: 'rectangle',
        ...config,
        stroke: '#1f2937',
        strokeWidth: 2,
      });
    });
  }
  
  private updateSelectionInfo(selectedIds: string[]): void {
    const info = document.getElementById('selection-info');
    if (info) {
      if (selectedIds.length === 0) {
        info.textContent = '選択されたShapeなし';
      } else {
        info.textContent = `選択中: ${selectedIds.length}個のShape`;
      }
    }
  }
  
  private highlightSelectedShapes(selectedIds: string[]): void {
    // 全てのShapeから選択状態を削除
    const allShapeElements = document.querySelectorAll('.wb-shape');
    allShapeElements.forEach(el => {
      el.classList.remove('wb-shape--selected');
    });
    
    // 選択されたShapeをハイライト
    selectedIds.forEach(id => {
      const element = document.querySelector(`[data-shape-id="${id}"]`);
      element?.classList.add('wb-shape--selected');
    });
  }
}
```

### 座標変換のデモ

```typescript
import { WhiteboardEngine } from 'dom-wb-handson';

class CoordinateDemo {
  private engine: WhiteboardEngine;
  private infoElement: HTMLElement;
  
  constructor(container: HTMLElement) {
    this.engine = new WhiteboardEngine({ container });
    this.infoElement = document.getElementById('coordinate-info')!;
    this.setupMouseTracking();
  }
  
  private setupMouseTracking(): void {
    const canvas = this.engine.getCanvasElement();
    
    canvas.addEventListener('mousemove', (event) => {
      // スクリーン座標
      const screenPoint = {
        x: event.clientX,
        y: event.clientY,
      };
      
      // ワールド座標に変換
      const worldPoint = this.engine.screenToWorld(screenPoint);
      
      // 情報を表示
      this.updateCoordinateInfo(screenPoint, worldPoint);
    });
    
    canvas.addEventListener('click', (event) => {
      const worldPoint = this.engine.screenToWorld({
        x: event.clientX,
        y: event.clientY,
      });
      
      // クリック位置に小さなShapeを追加
      this.addMarker(worldPoint);
    });
  }
  
  private updateCoordinateInfo(screen: Point, world: Point): void {
    this.infoElement.innerHTML = `
      <div>スクリーン座標: (${screen.x.toFixed(0)}, ${screen.y.toFixed(0)})</div>
      <div>ワールド座標: (${world.x.toFixed(1)}, ${world.y.toFixed(1)})</div>
    `;
  }
  
  private addMarker(point: Point): void {
    this.engine.addShape({
      type: 'rectangle',
      x: point.x - 5,
      y: point.y - 5,
      width: 10,
      height: 10,
      fill: '#ef4444',
      stroke: '#b91c1c',
      strokeWidth: 1,
    });
  }
}
```

## 🎯 実用的なアプリケーション例

### シンプルな図形描画アプリ

```typescript
import { 
  WhiteboardEngine, 
  SelectTool, 
  RectangleTool,
  EllipseTool 
} from 'dom-wb-handson';

class DrawingApp {
  private engine: WhiteboardEngine;
  private currentTool: string = 'select';
  
  constructor(container: HTMLElement) {
    this.engine = new WhiteboardEngine({
      container,
      width: 1000,
      height: 700,
      showGrid: true,
      gridSize: 20,
    });
    
    this.initializeTools();
    this.setupToolbar();
    this.setupEventHandlers();
  }
  
  private initializeTools(): void {
    // ツールを登録
    this.engine.toolManager.registerTool(new SelectTool());
    this.engine.toolManager.registerTool(new RectangleTool());
    this.engine.toolManager.registerTool(new EllipseTool());
    
    // デフォルトツールを設定
    this.engine.toolManager.setActiveTool('select');
  }
  
  private setupToolbar(): void {
    // ツール切り替えボタン
    document.querySelectorAll('[data-tool]').forEach(button => {
      button.addEventListener('click', (e) => {
        const tool = (e.target as HTMLElement).dataset.tool!;
        this.setActiveTool(tool);
      });
    });
    
    // カラーピッカー
    const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    colorPicker?.addEventListener('change', (e) => {
      this.setShapeColor((e.target as HTMLInputElement).value);
    });
    
    // クリアボタン
    document.getElementById('clear-all')?.addEventListener('click', () => {
      this.clearAll();
    });
  }
  
  private setupEventHandlers(): void {
    // Shape作成時のデフォルト設定適用
    this.engine.on('shape:created', (event) => {
      const shape = event.data.shape;
      console.log(`Created ${shape.type} shape:`, shape.id);
      
      // 作成されたShapeを自動選択
      this.engine.selectShape(shape.id);
    });
    
    // 選択変更時のツールバー更新
    this.engine.on('selection:changed', (event) => {
      this.updateToolbarForSelection(event.data.selectedIds);
    });
  }
  
  private setActiveTool(toolId: string): void {
    this.currentTool = toolId;
    this.engine.toolManager.setActiveTool(toolId);
    
    // UIの更新
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${toolId}"]`)?.classList.add('active');
  }
  
  private setShapeColor(color: string): void {
    const selectedShapes = this.engine.getSelectedShapes();
    selectedShapes.forEach(shape => {
      this.engine.updateShape(shape.id, { fill: color });
    });
  }
  
  private clearAll(): void {
    if (confirm('全てのShapeを削除しますか？')) {
      const allShapes = this.engine.getAllShapes();
      allShapes.forEach(shape => {
        this.engine.removeShape(shape.id);
      });
    }
  }
  
  private updateToolbarForSelection(selectedIds: string[]): void {
    const hasSelection = selectedIds.length > 0;
    
    // 選択時のみ有効なボタンの制御
    const selectionOnlyButtons = document.querySelectorAll('.selection-only');
    selectionOnlyButtons.forEach(btn => {
      (btn as HTMLElement).style.opacity = hasSelection ? '1' : '0.5';
      (btn as HTMLButtonElement).disabled = !hasSelection;
    });
  }
}

// 使用例
const container = document.getElementById('drawing-app-container')!;
const app = new DrawingApp(container);
```

### HTMLテンプレート

```html
<!-- 図形描画アプリのUI -->
<div class="drawing-app">
  <div class="toolbar">
    <div class="tool-group">
      <h3>ツール</h3>
      <button data-tool="select" class="tool-btn active">
        <span>🖱️</span> 選択
      </button>
      <button data-tool="rectangle" class="tool-btn">
        <span>⬜</span> 長方形
      </button>
      <button data-tool="ellipse" class="tool-btn">
        <span>⭕</span> 楕円
      </button>
    </div>
    
    <div class="tool-group">
      <h3>スタイル</h3>
      <label>
        色: <input type="color" id="color-picker" value="#3b82f6">
      </label>
    </div>
    
    <div class="tool-group">
      <h3>操作</h3>
      <button id="clear-all">全削除</button>
      <button class="selection-only" disabled>削除</button>
      <button class="selection-only" disabled>複製</button>
    </div>
  </div>
  
  <div id="drawing-app-container" class="canvas-container"></div>
  
  <div class="status-bar">
    <div id="selection-info">選択されたShapeなし</div>
    <div id="camera-info">Zoom: 100%</div>
  </div>
</div>

<style>
.drawing-app {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 20px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tool-group h3 {
  margin: 0 0 5px 0;
  font-size: 14px;
  color: #64748b;
}

.tool-btn {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
  text-align: left;
}

.tool-btn:hover {
  background: #f3f4f6;
}

.tool-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #2563eb;
}

.canvas-container {
  width: 1000px;
  height: 700px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  position: relative;
  overflow: hidden;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
  color: #64748b;
}

/* ホワイトボードShape要素のスタイル */
.wb-shape {
  position: absolute;
  pointer-events: auto;
  user-select: none;
  transition: outline 0.2s ease;
}

.wb-shape--rectangle {
  border: 2px solid;
  background: currentColor;
  opacity: 0.7;
  border-radius: 4px;
}

.wb-shape--ellipse {
  border: 2px solid;
  background: currentColor;
  opacity: 0.7;
  border-radius: 50%;
}

.wb-shape--selected {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

.wb-shape:hover {
  outline: 2px solid #94a3b8;
  outline-offset: 1px;
}

/* グリッド背景 */
.wb-canvas {
  background-image: 
    linear-gradient(to right, #f1f5f9 1px, transparent 1px),
    linear-gradient(to bottom, #f1f5f9 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
```

## 📚 ベストプラクティス

### パフォーマンス最適化

```typescript
// 大量のShapeを扱う場合の最適化
class OptimizedWhiteboard {
  private engine: WhiteboardEngine;
  private renderScheduled = false;
  
  constructor(container: HTMLElement) {
    this.engine = new WhiteboardEngine({
      container,
      // パフォーマンスオプション
      enableVirtualization: true,
      maxShapesPerFrame: 100,
      debounceTime: 16, // 60 FPS
    });
  }
  
  // バッチ操作でパフォーマンス向上
  addMultipleShapes(shapeConfigs: CreateShapeOptions[]): void {
    this.engine.batchUpdates(() => {
      shapeConfigs.forEach(config => {
        this.engine.addShape(config);
      });
    });
  }
  
  // デバウンス処理で頻繁な更新を制御
  private scheduleRender(): void {
    if (!this.renderScheduled) {
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.engine.render();
        this.renderScheduled = false;
      });
    }
  }
}
```

### エラーハンドリング

```typescript
class RobustWhiteboard {
  private engine: WhiteboardEngine;
  
  constructor(container: HTMLElement) {
    try {
      this.engine = new WhiteboardEngine({ container });
      this.setupErrorHandling();
    } catch (error) {
      console.error('Failed to initialize whiteboard:', error);
      this.showErrorMessage('ホワイトボードの初期化に失敗しました。');
    }
  }
  
  private setupErrorHandling(): void {
    // エラーイベントの監視
    this.engine.on('error', (event) => {
      console.error('Whiteboard error:', event.data);
      this.handleError(event.data);
    });
    
    // 回復可能なエラーの処理
    this.engine.on('warning', (event) => {
      console.warn('Whiteboard warning:', event.data);
      this.showWarning(event.data.message);
    });
  }
  
  private handleError(error: Error): void {
    // エラータイプに応じた処理
    if (error.name === 'ShapeCreationError') {
      this.showErrorMessage('図形の作成に失敗しました。');
    } else if (error.name === 'CoordinateError') {
      this.showErrorMessage('座標の計算でエラーが発生しました。');
    } else {
      this.showErrorMessage('予期しないエラーが発生しました。');
    }
  }
  
  private showErrorMessage(message: string): void {
    // ユーザーフレンドリーなエラー表示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}
```

### 状態の永続化

```typescript
class PersistentWhiteboard {
  private engine: WhiteboardEngine;
  private storageKey = 'whiteboard-state';
  
  constructor(container: HTMLElement) {
    this.engine = new WhiteboardEngine({ container });
    this.loadState();
    this.setupAutoSave();
  }
  
  private loadState(): void {
    try {
      const savedState = localStorage.getItem(this.storageKey);
      if (savedState) {
        const state = JSON.parse(savedState);
        this.engine.loadState(state);
        console.log('ホワイトボードの状態を復元しました');
      }
    } catch (error) {
      console.warn('状態の復元に失敗しました:', error);
    }
  }
  
  private setupAutoSave(): void {
    // 状態変更時の自動保存（デバウンス付き）
    let saveTimeout: number;
    
    this.engine.on(['shape:created', 'shape:updated', 'shape:deleted'], () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveState();
      }, 1000); // 1秒後に保存
    });
  }
  
  private saveState(): void {
    try {
      const state = this.engine.exportState();
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      console.log('ホワイトボードの状態を保存しました');
    } catch (error) {
      console.error('状態の保存に失敗しました:', error);
    }
  }
  
  exportToJSON(): string {
    return this.engine.exportState();
  }
  
  importFromJSON(jsonData: string): void {
    try {
      const state = JSON.parse(jsonData);
      this.engine.loadState(state);
    } catch (error) {
      throw new Error('無効なJSONデータです');
    }
  }
}
```

---

📖 **サンプルファイル**
- [basic-example.html](./basic/index.html) - 基本的な使用例
- [zoom-pan-demo.html](./zoom-pan/index.html) - ズーム・パン機能のデモ
- [selection-demo.html](./selection/index.html) - 選択・移動機能のデモ
- [drawing-app.html](./drawing-app/index.html) - 実用的な描画アプリ