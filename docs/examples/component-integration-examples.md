# コンポーネント統合サンプルコード

## 🚀 基本的な統合例

### 1. 最小構成での統合

```typescript
// main.ts - エントリーポイント
import { WhiteboardCanvas } from './src/WhiteboardCanvas';
import { useWhiteboardStore } from './src/store';
import './style.css';

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas');
  if (!container) {
    console.error('Canvas container not found');
    return;
  }
  
  // WhiteboardCanvasの初期化
  const whiteboard = new WhiteboardCanvas(container);
  
  // グローバルアクセス用（デバッグ用）
  (window as any).whiteboard = whiteboard;
  (window as any).store = useWhiteboardStore;
  
  // 初期データの追加（デモ用）
  addDemoShapes();
});

function addDemoShapes() {
  const store = useWhiteboardStore.getState();
  
  // テスト用のShapeを追加
  store.addShape({
    id: 'demo-rect-1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    strokeColor: '#2563eb',
    fillColor: '#dbeafe',
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
  });
  
  store.addShape({
    id: 'demo-ellipse-1',
    type: 'ellipse',
    x: 350,
    y: 150,
    width: 150,
    height: 150,
    strokeColor: '#dc2626',
    fillColor: '#fee2e2',
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
  });
}
```

### 2. ツールバー付きの統合

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DOM Whiteboard</title>
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <div class="whiteboard-app">
    <!-- ツールバー -->
    <div class="toolbar" id="toolbar">
      <button id="select-tool" class="tool-button active" data-tool="select" title="Select (V)">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2l-7.5 18.3L9.8 22l2.2-5.1h6l2.2 5.1 5.3-1.7L12 2z"/>
        </svg>
      </button>
      <button id="rectangle-tool" class="tool-button" data-tool="rectangle" title="Rectangle (R)">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="4" y="6" width="16" height="12" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
      <button id="ellipse-tool" class="tool-button" data-tool="ellipse" title="Ellipse (E)">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
      <div class="toolbar-separator"></div>
      <button id="delete-button" class="tool-button" title="Delete (Del)">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    </div>
    
    <!-- キャンバス -->
    <div id="canvas" class="whiteboard-canvas-container"></div>
    
    <!-- ステータスバー -->
    <div class="status-bar">
      <span id="status-selection">No selection</span>
      <span id="status-tool">Tool: Select</span>
      <span id="status-zoom">Zoom: 100%</span>
    </div>
  </div>
  
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

```typescript
// src/main.ts - ツールバー統合
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { useWhiteboardStore } from './store';
import { setupToolbar } from './ui/toolbar';
import { setupStatusBar } from './ui/statusBar';
import './style.css';

class WhiteboardApp {
  private canvas: WhiteboardCanvas;
  private store = useWhiteboardStore;
  
  constructor() {
    this.initializeCanvas();
    this.setupUI();
    this.setupKeyboardShortcuts();
    this.loadInitialData();
  }
  
  private initializeCanvas(): void {
    const container = document.getElementById('canvas');
    if (!container) {
      throw new Error('Canvas container not found');
    }
    
    this.canvas = new WhiteboardCanvas(container);
  }
  
  private setupUI(): void {
    // ツールバーのセットアップ
    setupToolbar(this.canvas);
    
    // ステータスバーのセットアップ
    setupStatusBar(this.store);
  }
  
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // ツール切り替えショートカット
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            this.canvas.setActiveTool('select');
            this.updateToolbarState('select');
            break;
          case 'r':
            this.canvas.setActiveTool('rectangle');
            this.updateToolbarState('rectangle');
            break;
          case 'e':
            this.canvas.setActiveTool('ellipse');
            this.updateToolbarState('ellipse');
            break;
        }
      }
      
      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelectedShapes();
      }
    });
  }
  
  private updateToolbarState(toolId: string): void {
    document.querySelectorAll('.tool-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const activeButton = document.querySelector(`[data-tool="${toolId}"]`);
    activeButton?.classList.add('active');
  }
  
  private deleteSelectedShapes(): void {
    const selectedIds = this.store.getState().selectedShapeIds;
    if (selectedIds.length > 0) {
      selectedIds.forEach(id => {
        this.store.getState().removeShape(id);
      });
    }
  }
  
  private loadInitialData(): void {
    // デモデータまたは保存されたデータを読み込む
    const savedData = localStorage.getItem('whiteboard-data');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        data.shapes.forEach((shape: any) => {
          this.store.getState().addShape(shape);
        });
      } catch (error) {
        console.error('Failed to load saved data:', error);
      }
    }
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  new WhiteboardApp();
});
```

### 3. UI ヘルパー関数

```typescript
// src/ui/toolbar.ts
export function setupToolbar(canvas: WhiteboardCanvas): void {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;
  
  // ツールボタンのイベント設定
  toolbar.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('.tool-button');
    if (!button) return;
    
    const toolId = button.getAttribute('data-tool');
    if (toolId) {
      canvas.setActiveTool(toolId);
      updateToolbarState(toolId);
    }
    
    // 削除ボタン
    if (button.id === 'delete-button') {
      deleteSelectedShapes();
    }
  });
}

function updateToolbarState(activeTool: string): void {
  document.querySelectorAll('.tool-button[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tool') === activeTool);
  });
  
  // ステータスバー更新
  const statusTool = document.getElementById('status-tool');
  if (statusTool) {
    statusTool.textContent = `Tool: ${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}`;
  }
}

function deleteSelectedShapes(): void {
  const store = useWhiteboardStore.getState();
  const selectedIds = store.selectedShapeIds;
  
  if (selectedIds.length > 0) {
    if (confirm(`Delete ${selectedIds.length} shape(s)?`)) {
      selectedIds.forEach(id => store.removeShape(id));
    }
  }
}
```

```typescript
// src/ui/statusBar.ts
export function setupStatusBar(store: typeof useWhiteboardStore): void {
  // 選択状態の監視
  store.subscribe(
    state => state.selectedShapeIds,
    (selectedIds) => {
      const statusSelection = document.getElementById('status-selection');
      if (statusSelection) {
        if (selectedIds.length === 0) {
          statusSelection.textContent = 'No selection';
        } else if (selectedIds.length === 1) {
          statusSelection.textContent = '1 shape selected';
        } else {
          statusSelection.textContent = `${selectedIds.length} shapes selected`;
        }
      }
    }
  );
  
  // カメラ状態の監視
  store.subscribe(
    state => state.camera,
    (camera) => {
      const statusZoom = document.getElementById('status-zoom');
      if (statusZoom) {
        statusZoom.textContent = `Zoom: ${Math.round(camera.zoom * 100)}%`;
      }
    }
  );
}
```

## 🎨 カスタムツールの実装例

### PolygonTool - 多角形描画ツール

```typescript
// src/tools/PolygonTool.ts
import { Tool, ToolContext } from '../types/tool';
import { Point } from '../types/geometry';

export class PolygonTool implements Tool {
  id = 'polygon';
  name = 'Polygon';
  icon = 'polygon';
  cursor = 'crosshair';
  
  private points: Point[] = [];
  private isDrawing = false;
  private previewElement: HTMLElement | null = null;
  
  onActivate(context: ToolContext): void {
    console.log('Polygon tool activated');
  }
  
  onDeactivate(): void {
    this.cancel();
  }
  
  onPointerDown(event: PointerEvent, context: ToolContext): void {
    if (event.button === 2) { // 右クリックで終了
      this.complete(context);
      return;
    }
    
    const point = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    if (!this.isDrawing) {
      this.isDrawing = true;
      this.createPreview(context);
    }
    
    this.points.push(point);
    this.updatePreview(context);
  }
  
  onPointerMove(event: PointerEvent, context: ToolContext): void {
    if (!this.isDrawing || !this.previewElement) return;
    
    const currentPoint = context.screenToWorld({
      x: event.clientX,
      y: event.clientY,
    });
    
    // 現在のマウス位置までの線をプレビュー
    this.updatePreviewWithTempPoint(currentPoint, context);
  }
  
  onKeyDown(event: KeyboardEvent, context: ToolContext): void {
    if (event.key === 'Escape') {
      this.cancel();
    } else if (event.key === 'Enter' && this.points.length >= 3) {
      this.complete(context);
    }
  }
  
  private createPreview(context: ToolContext): void {
    this.previewElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.previewElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
    `;
    
    const shapeLayer = context.canvas.querySelector('.shape-layer');
    if (shapeLayer) {
      shapeLayer.appendChild(this.previewElement);
    }
  }
  
  private updatePreview(context: ToolContext): void {
    if (!this.previewElement) return;
    
    const path = this.createPathElement(this.points, context);
    this.previewElement.innerHTML = '';
    this.previewElement.appendChild(path);
  }
  
  private updatePreviewWithTempPoint(tempPoint: Point, context: ToolContext): void {
    if (!this.previewElement || this.points.length === 0) return;
    
    const allPoints = [...this.points, tempPoint];
    const path = this.createPathElement(allPoints, context);
    this.previewElement.innerHTML = '';
    this.previewElement.appendChild(path);
  }
  
  private createPathElement(points: Point[], context: ToolContext): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    if (points.length < 2) return path;
    
    // パスデータを構築
    const screenPoints = points.map(p => context.worldToScreen(p));
    let d = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
    
    for (let i = 1; i < screenPoints.length; i++) {
      d += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
    }
    
    // 閉じていない場合は点線で表示
    if (this.isDrawing) {
      path.setAttribute('stroke-dasharray', '5,5');
    } else {
      d += ' Z'; // パスを閉じる
    }
    
    path.setAttribute('d', d);
    path.setAttribute('stroke', '#0066ff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'rgba(0, 102, 255, 0.1)');
    
    return path;
  }
  
  private complete(context: ToolContext): void {
    if (this.points.length < 3) return;
    
    // Polygonシェイプを作成
    context.startTransaction();
    
    const shape = context.store.addShape({
      type: 'polygon',
      points: this.points,
      strokeColor: '#000000',
      fillColor: 'rgba(255, 255, 255, 0.8)',
      strokeWidth: 2,
      rotation: 0,
      opacity: 1,
    });
    
    context.store.selectShape(shape.id);
    context.commitTransaction();
    
    this.cancel();
  }
  
  private cancel(): void {
    this.points = [];
    this.isDrawing = false;
    
    if (this.previewElement) {
      this.previewElement.remove();
      this.previewElement = null;
    }
  }
}
```

### カスタムツールの登録

```typescript
// main.ts - カスタムツールの追加
import { PolygonTool } from './tools/PolygonTool';

// WhiteboardCanvasの拡張
class ExtendedWhiteboardCanvas extends WhiteboardCanvas {
  constructor(container: HTMLElement) {
    super(container);
    this.registerCustomTools();
  }
  
  private registerCustomTools(): void {
    // カスタムツールを追加
    this.toolManager.registerTool(new PolygonTool());
  }
}

// ツールバーにボタンを追加
function addPolygonToolButton(): void {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;
  
  const polygonButton = document.createElement('button');
  polygonButton.id = 'polygon-tool';
  polygonButton.className = 'tool-button';
  polygonButton.setAttribute('data-tool', 'polygon');
  polygonButton.setAttribute('title', 'Polygon (P)');
  polygonButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20">
      <polygon points="12,2 22,10 18,21 6,21 2,10" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
  `;
  
  // 楕円ツールの後に追加
  const ellipseTool = document.getElementById('ellipse-tool');
  ellipseTool?.insertAdjacentElement('afterend', polygonButton);
}
```

## 🔧 プラグインシステムの実装

### プラグインインターフェース

```typescript
// src/plugins/Plugin.ts
export interface WhiteboardPlugin {
  name: string;
  version: string;
  description?: string;
  
  install(whiteboard: WhiteboardCanvas): void;
  uninstall?(whiteboard: WhiteboardCanvas): void;
}

// プラグインマネージャー
export class PluginManager {
  private plugins = new Map<string, WhiteboardPlugin>();
  
  constructor(private whiteboard: WhiteboardCanvas) {}
  
  install(plugin: WhiteboardPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} is already installed`);
      return;
    }
    
    try {
      plugin.install(this.whiteboard);
      this.plugins.set(plugin.name, plugin);
      console.log(`Plugin ${plugin.name} v${plugin.version} installed`);
    } catch (error) {
      console.error(`Failed to install plugin ${plugin.name}:`, error);
    }
  }
  
  uninstall(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.warn(`Plugin ${pluginName} is not installed`);
      return;
    }
    
    try {
      plugin.uninstall?.(this.whiteboard);
      this.plugins.delete(pluginName);
      console.log(`Plugin ${pluginName} uninstalled`);
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error);
    }
  }
  
  getInstalledPlugins(): WhiteboardPlugin[] {
    return Array.from(this.plugins.values());
  }
}
```

### プラグイン例: グリッドスナップ

```typescript
// src/plugins/GridSnapPlugin.ts
import { WhiteboardPlugin } from './Plugin';
import { WhiteboardCanvas } from '../WhiteboardCanvas';

export class GridSnapPlugin implements WhiteboardPlugin {
  name = 'grid-snap';
  version = '1.0.0';
  description = 'Snap shapes to grid while drawing and moving';
  
  private gridSize = 20;
  private enabled = true;
  private originalHandlers = new Map<string, Function>();
  
  install(whiteboard: WhiteboardCanvas): void {
    // グリッド表示を追加
    this.addGridBackground(whiteboard);
    
    // ツールの動作を拡張
    this.extendTools(whiteboard);
    
    // 設定UIを追加
    this.addSettingsUI(whiteboard);
  }
  
  uninstall(whiteboard: WhiteboardCanvas): void {
    // グリッド表示を削除
    this.removeGridBackground(whiteboard);
    
    // 元の動作に戻す
    this.restoreTools(whiteboard);
    
    // 設定UIを削除
    this.removeSettingsUI();
  }
  
  private addGridBackground(whiteboard: WhiteboardCanvas): void {
    const style = document.createElement('style');
    style.id = 'grid-snap-styles';
    style.textContent = `
      .whiteboard-canvas.grid-enabled {
        background-image: 
          repeating-linear-gradient(0deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${this.gridSize}px),
          repeating-linear-gradient(90deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${this.gridSize}px);
        background-size: ${this.gridSize}px ${this.gridSize}px;
      }
    `;
    document.head.appendChild(style);
    
    const canvas = whiteboard.getContainer();
    canvas.classList.add('grid-enabled');
  }
  
  private removeGridBackground(whiteboard: WhiteboardCanvas): void {
    const style = document.getElementById('grid-snap-styles');
    style?.remove();
    
    const canvas = whiteboard.getContainer();
    canvas.classList.remove('grid-enabled');
  }
  
  private extendTools(whiteboard: WhiteboardCanvas): void {
    // ツールのポインター処理を拡張
    const tools = whiteboard.getToolManager().getAllTools();
    
    tools.forEach(tool => {
      // 元のハンドラーを保存
      if (tool.onPointerMove) {
        this.originalHandlers.set(`${tool.id}-move`, tool.onPointerMove);
        
        // スナップ機能を追加
        tool.onPointerMove = (event, context) => {
          const point = context.screenToWorld({
            x: event.clientX,
            y: event.clientY,
          });
          
          // グリッドにスナップ
          if (this.enabled) {
            point.x = Math.round(point.x / this.gridSize) * this.gridSize;
            point.y = Math.round(point.y / this.gridSize) * this.gridSize;
          }
          
          // 修正されたイベントで元のハンドラーを呼び出す
          const originalHandler = this.originalHandlers.get(`${tool.id}-move`);
          if (originalHandler) {
            const modifiedEvent = new PointerEvent(event.type, {
              ...event,
              clientX: context.worldToScreen(point).x,
              clientY: context.worldToScreen(point).y,
            });
            originalHandler.call(tool, modifiedEvent, context);
          }
        };
      }
    });
  }
  
  private restoreTools(whiteboard: WhiteboardCanvas): void {
    const tools = whiteboard.getToolManager().getAllTools();
    
    tools.forEach(tool => {
      const moveHandler = this.originalHandlers.get(`${tool.id}-move`);
      if (moveHandler) {
        tool.onPointerMove = moveHandler as any;
      }
    });
    
    this.originalHandlers.clear();
  }
  
  private addSettingsUI(whiteboard: WhiteboardCanvas): void {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;
    
    const settingsDiv = document.createElement('div');
    settingsDiv.id = 'grid-snap-settings';
    settingsDiv.className = 'toolbar-settings';
    settingsDiv.innerHTML = `
      <label>
        <input type="checkbox" id="grid-snap-enabled" checked>
        Snap to Grid
      </label>
      <label>
        Grid Size:
        <input type="number" id="grid-size" value="${this.gridSize}" min="10" max="100" step="10">
      </label>
    `;
    
    toolbar.appendChild(settingsDiv);
    
    // イベントハンドラー
    const enabledCheckbox = document.getElementById('grid-snap-enabled') as HTMLInputElement;
    enabledCheckbox?.addEventListener('change', (e) => {
      this.enabled = (e.target as HTMLInputElement).checked;
    });
    
    const sizeInput = document.getElementById('grid-size') as HTMLInputElement;
    sizeInput?.addEventListener('change', (e) => {
      this.gridSize = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateGridSize();
    });
  }
  
  private removeSettingsUI(): void {
    const settings = document.getElementById('grid-snap-settings');
    settings?.remove();
  }
  
  private updateGridSize(): void {
    const style = document.getElementById('grid-snap-styles') as HTMLStyleElement;
    if (style) {
      style.textContent = style.textContent!.replace(/\d+px/g, `${this.gridSize}px`);
    }
  }
}
```

### プラグインの使用

```typescript
// main.ts - プラグインの使用例
import { GridSnapPlugin } from './plugins/GridSnapPlugin';
import { AutoSavePlugin } from './plugins/AutoSavePlugin';

class WhiteboardApp {
  private whiteboard: ExtendedWhiteboardCanvas;
  private pluginManager: PluginManager;
  
  constructor() {
    this.initializeCanvas();
    this.initializePlugins();
  }
  
  private initializeCanvas(): void {
    const container = document.getElementById('canvas')!;
    this.whiteboard = new ExtendedWhiteboardCanvas(container);
    this.pluginManager = new PluginManager(this.whiteboard);
  }
  
  private initializePlugins(): void {
    // プラグインをインストール
    this.pluginManager.install(new GridSnapPlugin());
    this.pluginManager.install(new AutoSavePlugin());
    
    // プラグイン管理UIを追加
    this.createPluginManagerUI();
  }
  
  private createPluginManagerUI(): void {
    const pluginButton = document.createElement('button');
    pluginButton.textContent = 'Plugins';
    pluginButton.addEventListener('click', () => {
      this.showPluginManager();
    });
    
    document.getElementById('toolbar')?.appendChild(pluginButton);
  }
  
  private showPluginManager(): void {
    const plugins = this.pluginManager.getInstalledPlugins();
    const pluginList = plugins.map(p => 
      `${p.name} v${p.version} - ${p.description || 'No description'}`
    ).join('\n');
    
    alert(`Installed Plugins:\n\n${pluginList}`);
  }
}
```

## 📋 完全な統合例

完全な統合例のファイル構造:

```
dom-wb-handson/
├── src/
│   ├── components/
│   │   ├── WhiteboardCanvas.ts
│   │   ├── SelectionLayer.ts
│   │   └── index.ts
│   ├── tools/
│   │   ├── ToolManager.ts
│   │   ├── SelectTool.ts
│   │   ├── RectangleTool.ts
│   │   ├── EllipseTool.ts
│   │   ├── PolygonTool.ts
│   │   └── index.ts
│   ├── plugins/
│   │   ├── Plugin.ts
│   │   ├── GridSnapPlugin.ts
│   │   ├── AutoSavePlugin.ts
│   │   └── index.ts
│   ├── ui/
│   │   ├── toolbar.ts
│   │   ├── statusBar.ts
│   │   └── index.ts
│   ├── store/
│   │   └── index.ts
│   ├── types/
│   │   ├── shape.ts
│   │   ├── tool.ts
│   │   ├── geometry.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── coordinates.ts
│   │   ├── dom.ts
│   │   └── index.ts
│   ├── main.ts
│   └── style.css
├── public/
│   └── index.html
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── package.json
```

これらの例を参考に、プロジェクトの要件に合わせてコンポーネントを統合してください。