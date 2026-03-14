# Tool System API Design Document

## 🎯 API設計原則

### 設計哲学
1. **Progressive Disclosure**: シンプルな用途から高度な用途まで段階的に機能を公開
2. **Type Safety**: TypeScriptの型システムを最大限活用
3. **Composability**: 小さな部品を組み合わせて複雑な機能を実現
4. **Testability**: テストしやすいインターフェース設計

## 📦 Core APIs

### 1. Tool Creation API

#### Basic Tool Creation
最もシンプルなTool作成方法。初心者向け。

```typescript
import { createTool } from '@usketch/drawing-tools';

const myPencilTool = createTool({
  id: 'pencil',
  name: 'Pencil Tool',
  icon: '✏️',
  cursor: 'crosshair',
  
  // シンプルなイベントハンドラー
  onActivate() {
    console.log('Pencil tool activated');
  },
  
  onPointerDown(event, worldPos) {
    // 描画開始
    this.startDrawing(worldPos);
  },
  
  onPointerMove(event, worldPos) {
    // 描画継続
    if (this.isDrawing) {
      this.addPoint(worldPos);
    }
  },
  
  onPointerUp(event, worldPos) {
    // 描画終了
    this.endDrawing();
  }
});
```

#### State-Based Tool Creation
StateMachineベースの中級者向けAPI。

```typescript
import { createStatefulTool } from '@usketch/drawing-tools';

const mySelectTool = createStatefulTool({
  id: 'select',
  name: 'Select Tool',
  
  // 状態定義
  states: {
    idle: {
      cursor: 'default',
      on: {
        POINTER_DOWN: 'selecting'
      }
    },
    selecting: {
      cursor: 'crosshair',
      on: {
        POINTER_MOVE: 'selecting',
        POINTER_UP: 'idle'
      }
    },
    dragging: {
      cursor: 'move',
      on: {
        POINTER_MOVE: 'dragging',
        POINTER_UP: 'idle'
      }
    }
  },
  
  // 初期状態
  initialState: 'idle',
  
  // コンテキスト（共有データ）
  context: {
    selectedIds: new Set<string>(),
    dragStart: null as Point | null,
    dragOffset: null as Point | null
  },
  
  // アクション
  actions: {
    startSelection(ctx, event) {
      ctx.selectedIds.clear();
      ctx.dragStart = event.worldPos;
    },
    
    updateSelection(ctx, event) {
      const bounds = getBounds(ctx.dragStart!, event.worldPos);
      ctx.selectedIds = getShapesInBounds(bounds);
    },
    
    startDragging(ctx, event) {
      ctx.dragOffset = event.worldPos;
    }
  }
});
```

#### Advanced Tool Creation
完全な制御が可能な上級者向けAPI。

```typescript
import { Tool, ToolStateMachine, ToolContext } from '@usketch/drawing-tools';

class AdvancedBrushTool extends Tool {
  private stateMachine: ToolStateMachine<BrushStates>;
  private brushEngine: BrushEngine;
  
  constructor() {
    super({
      id: 'advanced-brush',
      name: 'Advanced Brush'
    });
    
    // カスタムStateMachine
    this.stateMachine = new ToolStateMachine({
      initial: 'idle',
      states: this.defineStates(),
      actions: this.defineActions(),
      guards: this.defineGuards(),
      services: this.defineServices()
    });
    
    // カスタムエンジン
    this.brushEngine = new BrushEngine({
      pressure: true,
      tilt: true,
      texture: 'watercolor'
    });
  }
  
  private defineStates() {
    return {
      idle: {
        entry: 'resetBrush',
        on: {
          POINTER_DOWN: {
            target: 'painting',
            guard: 'canPaint'
          }
        }
      },
      painting: {
        entry: 'startStroke',
        exit: 'endStroke',
        on: {
          POINTER_MOVE: {
            actions: 'addStrokePoint'
          },
          POINTER_UP: 'idle',
          PRESSURE_CHANGE: {
            actions: 'updatePressure'
          }
        },
        invoke: {
          src: 'smoothingService',
          onDone: 'idle',
          onError: 'error'
        }
      },
      error: {
        entry: 'logError',
        on: {
          RETRY: 'idle',
          CANCEL: 'idle'
        }
      }
    };
  }
  
  private defineActions() {
    return {
      resetBrush: () => this.brushEngine.reset(),
      startStroke: (ctx, event) => {
        this.brushEngine.startStroke(event.worldPos, event.pressure);
      },
      addStrokePoint: (ctx, event) => {
        this.brushEngine.addPoint(event.worldPos, event.pressure, event.tilt);
      },
      endStroke: () => {
        const stroke = this.brushEngine.endStroke();
        this.saveStroke(stroke);
      },
      updatePressure: (ctx, event) => {
        this.brushEngine.setPressure(event.pressure);
      },
      logError: (ctx, event) => {
        console.error('Brush tool error:', event.data);
      }
    };
  }
  
  private defineGuards() {
    return {
      canPaint: (ctx) => {
        return !ctx.isLocked && ctx.hasPermission;
      }
    };
  }
  
  private defineServices() {
    return {
      smoothingService: () => (callback) => {
        const interval = setInterval(() => {
          this.brushEngine.smooth();
        }, 16); // 60fps
        
        return () => clearInterval(interval);
      }
    };
  }
}
```

### 2. Tool Composition API

#### Mixin-based Composition
機能をミックスインで組み合わせる。

```typescript
import { composeTool, Draggable, Selectable, Snappable } from '@usketch/drawing-tools';

// 機能を組み合わせてToolを作成
const myCompositeTool = composeTool(
  Draggable(),
  Selectable({ multiSelect: true }),
  Snappable({ gridSize: 10 })
)({
  id: 'composite-tool',
  name: 'Composite Tool',
  
  // 組み合わせた機能を活用
  onPointerDown(event, worldPos) {
    // Selectableから継承
    this.selectAt(worldPos);
    
    // Draggableから継承
    if (this.hasSelection()) {
      this.startDrag(worldPos);
    }
  },
  
  onPointerMove(event, worldPos) {
    if (this.isDragging()) {
      // Snappableから継承
      const snappedPos = this.snapToGrid(worldPos);
      this.updateDrag(snappedPos);
    }
  }
});
```

#### Capability-based Composition
能力ベースの組み合わせ。

```typescript
import { withCapabilities } from '@usketch/drawing-tools';

const myToolWithCapabilities = withCapabilities({
  // 基本Tool設定
  id: 'capable-tool',
  name: 'Capable Tool',
  
  // 能力を追加
  capabilities: [
    // 組み込み能力
    'select',
    'move',
    'rotate',
    'scale',
    
    // カスタム能力
    {
      name: 'customDraw',
      handlers: {
        onPointerDown: (ctx) => { /* ... */ },
        onPointerMove: (ctx) => { /* ... */ }
      }
    }
  ],
  
  // 能力の設定
  config: {
    select: { mode: 'multiple' },
    move: { snapToGrid: true },
    rotate: { snapAngle: 15 },
    scale: { maintainAspectRatio: true }
  }
});
```

### 3. Tool Registry API

#### Tool Registration
Toolの登録と管理。

```typescript
import { ToolRegistry } from '@usketch/drawing-tools';

const registry = new ToolRegistry();

// Tool登録
registry.register(myPencilTool);
registry.register(mySelectTool);
registry.register(myBrushTool);

// Tool取得
const pencil = registry.get('pencil');
const allTools = registry.getAll();

// Tool削除
registry.unregister('pencil');

// バッチ操作
registry.registerBatch([tool1, tool2, tool3]);

// イベントリスナー
registry.on('register', (tool) => {
  console.log(`Tool registered: ${tool.id}`);
});

registry.on('unregister', (toolId) => {
  console.log(`Tool unregistered: ${toolId}`);
});
```

#### Tool Discovery
Tool検索とフィルタリング。

```typescript
// タグベースの検索
const drawingTools = registry.findByTag('drawing');
const selectionTools = registry.findByTag('selection');

// 能力ベースの検索
const toolsWithSnap = registry.findByCapability('snap');

// カスタムフィルター
const customTools = registry.filter(tool => 
  tool.metadata?.author === 'custom'
);

// Tool情報取得
const toolInfo = registry.getInfo('pencil');
console.log(toolInfo);
// {
//   id: 'pencil',
//   name: 'Pencil Tool',
//   version: '1.0.0',
//   capabilities: ['draw'],
//   tags: ['drawing', 'freehand'],
//   metadata: { ... }
// }
```

### 4. Tool Lifecycle API

#### Lifecycle Hooks
Toolのライフサイクル管理。

```typescript
const myToolWithLifecycle = createTool({
  id: 'lifecycle-tool',
  name: 'Lifecycle Tool',
  
  // ライフサイクルフック
  hooks: {
    // 初期化時
    onInit(context) {
      console.log('Tool initialized');
      this.loadSettings();
    },
    
    // アクティベート時
    onActivate(context) {
      console.log('Tool activated');
      this.showUI();
    },
    
    // デアクティベート時
    onDeactivate(context) {
      console.log('Tool deactivated');
      this.hideUI();
      this.saveState();
    },
    
    // 破棄時
    onDestroy(context) {
      console.log('Tool destroyed');
      this.cleanup();
    },
    
    // エラー時
    onError(error, context) {
      console.error('Tool error:', error);
      this.handleError(error);
    }
  }
});
```

#### Tool Context API
Tool間でのコンテキスト共有。

```typescript
import { ToolContext } from '@usketch/drawing-tools';

// グローバルコンテキスト
const globalContext = new ToolContext({
  canvas: canvasRef,
  store: whiteboardStore,
  theme: 'dark',
  user: currentUser
});

// Tool固有のコンテキスト
const toolContext = globalContext.createChild({
  toolId: 'my-tool',
  settings: toolSettings
});

// コンテキストの使用
const myContextAwareTool = createTool({
  id: 'context-aware',
  name: 'Context Aware Tool',
  
  onActivate(context: ToolContext) {
    const canvas = context.get('canvas');
    const theme = context.get('theme');
    
    // コンテキストの更新
    context.set('activeTool', this.id);
    
    // コンテキストの監視
    context.watch('theme', (newTheme) => {
      this.updateTheme(newTheme);
    });
  }
});
```

### 5. Tool Extension API

#### Plugin System
Toolを拡張するプラグインシステム。

```typescript
import { ToolPlugin, createPlugin } from '@usketch/drawing-tools';

// プラグイン作成
const myPlugin = createPlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  
  // 提供するTool
  tools: [
    customTool1,
    customTool2
  ],
  
  // 既存Toolの拡張
  extensions: {
    'pencil': {
      // 新しい機能を追加
      addTextureSupport() {
        this.texture = 'rough';
      },
      
      // 既存メソッドをオーバーライド
      onPointerDown(original, event, worldPos) {
        console.log('Extended pointer down');
        original.call(this, event, worldPos);
      }
    }
  },
  
  // プラグインのライフサイクル
  install(registry, context) {
    console.log('Plugin installed');
    this.setupCustomShortcuts();
  },
  
  uninstall(registry, context) {
    console.log('Plugin uninstalled');
    this.cleanupCustomShortcuts();
  }
});

// プラグインの使用
registry.installPlugin(myPlugin);
registry.uninstallPlugin('my-plugin');
```

#### Tool Decorators
デコレーターパターンでToolを拡張。

```typescript
import { decorateTool } from '@usketch/drawing-tools';

// ログ機能を追加
const toolWithLogging = decorateTool(myTool, {
  before: {
    onPointerDown(event, worldPos) {
      console.log(`Pointer down at ${worldPos.x}, ${worldPos.y}`);
    }
  },
  
  after: {
    onPointerUp(event, worldPos) {
      console.log(`Pointer up at ${worldPos.x}, ${worldPos.y}`);
    }
  },
  
  around: {
    onPointerMove(proceed, event, worldPos) {
      const start = performance.now();
      proceed(event, worldPos);
      const duration = performance.now() - start;
      if (duration > 16) {
        console.warn(`Slow pointer move: ${duration}ms`);
      }
    }
  }
});
```

## 🧪 Testing Utilities

### Tool Testing Helpers

```typescript
import { createToolTestHarness } from '@usketch/drawing-tools/testing';

describe('MyCustomTool', () => {
  let harness: ToolTestHarness;
  let tool: MyCustomTool;
  
  beforeEach(() => {
    harness = createToolTestHarness();
    tool = new MyCustomTool();
    harness.mount(tool);
  });
  
  it('should handle pointer events', async () => {
    // シミュレートイベント
    await harness.pointerDown({ x: 100, y: 100 });
    expect(tool.isDrawing).toBe(true);
    
    await harness.pointerMove({ x: 150, y: 150 });
    expect(tool.points).toHaveLength(2);
    
    await harness.pointerUp({ x: 200, y: 200 });
    expect(tool.isDrawing).toBe(false);
  });
  
  it('should transition states correctly', async () => {
    expect(harness.getCurrentState()).toBe('idle');
    
    await harness.pointerDown({ x: 0, y: 0 });
    expect(harness.getCurrentState()).toBe('drawing');
    
    await harness.pointerUp({ x: 0, y: 0 });
    expect(harness.getCurrentState()).toBe('idle');
  });
  
  it('should handle keyboard shortcuts', async () => {
    await harness.keyDown('Escape');
    expect(tool.isCancelled).toBe(true);
    
    await harness.keyDown('Enter');
    expect(tool.isConfirmed).toBe(true);
  });
});
```

### State Machine Testing

```typescript
import { testStateMachine } from '@usketch/drawing-tools/testing';

describe('Tool State Machine', () => {
  it('should have valid state transitions', () => {
    const result = testStateMachine(myTool.stateMachine, {
      states: ['idle', 'drawing', 'editing'],
      transitions: [
        { from: 'idle', to: 'drawing', event: 'START' },
        { from: 'drawing', to: 'idle', event: 'END' },
        { from: 'drawing', to: 'editing', event: 'EDIT' }
      ],
      invalidTransitions: [
        { from: 'idle', to: 'editing', event: 'EDIT' }
      ]
    });
    
    expect(result.valid).toBe(true);
    expect(result.coverage).toBeGreaterThan(0.9);
  });
});
```

## 📐 Type Definitions

### Core Types

```typescript
// 基本的な型定義
type ToolId = string;
type ToolName = string;
type ToolIcon = string | ReactNode;

interface Point {
  x: number;
  y: number;
}

interface ToolEvent {
  type: string;
  timestamp: number;
  data?: any;
}

// Tool状態の型
interface ToolState<T = any> {
  name: string;
  data?: T;
  cursor?: CSSCursor;
  active?: boolean;
}

// Tool設定の型
interface ToolConfig {
  id: ToolId;
  name: ToolName;
  icon?: ToolIcon;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Toolハンドラーの型
interface ToolHandlers {
  onActivate?: (context: ToolContext) => void;
  onDeactivate?: (context: ToolContext) => void;
  onPointerDown?: (event: PointerEvent, worldPos: Point) => void;
  onPointerMove?: (event: PointerEvent, worldPos: Point) => void;
  onPointerUp?: (event: PointerEvent, worldPos: Point) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onWheel?: (event: WheelEvent) => void;
  onDoubleClick?: (event: MouseEvent, worldPos: Point) => void;
}

// StateMachine型
interface StateMachineConfig<States> {
  initial: keyof States;
  states: States;
  context?: any;
  actions?: Record<string, Action>;
  guards?: Record<string, Guard>;
  services?: Record<string, Service>;
}

type Action<Context = any, Event = any> = (
  context: Context,
  event: Event
) => void | Context;

type Guard<Context = any, Event = any> = (
  context: Context,
  event: Event
) => boolean;

type Service<Context = any> = (
  context: Context
) => Promise<any> | (() => void);
```

## 🔄 Migration Guide

### 既存Toolからの移行

```typescript
// Before (Legacy Tool)
class LegacyTool implements Tool {
  id = 'legacy';
  name = 'Legacy Tool';
  private isDragging = false;
  
  onPointerDown(event: PointerEvent, worldPos: Point) {
    this.isDragging = true;
    // Handle logic
  }
  
  onPointerUp(event: PointerEvent, worldPos: Point) {
    this.isDragging = false;
    // Handle logic
  }
}

// After (Modern Tool)
const modernTool = createStatefulTool({
  id: 'modern',
  name: 'Modern Tool',
  
  states: {
    idle: {
      on: { POINTER_DOWN: 'dragging' }
    },
    dragging: {
      on: { POINTER_UP: 'idle' }
    }
  },
  
  initialState: 'idle',
  
  actions: {
    startDrag(ctx, event) {
      // Handle logic
    },
    endDrag(ctx, event) {
      // Handle logic
    }
  }
});
```

## 📊 Performance Considerations

### Best Practices

```typescript
// 1. イベントハンドラーの最適化
const optimizedTool = createTool({
  id: 'optimized',
  name: 'Optimized Tool',
  
  // Debounced/Throttled handlers
  onPointerMove: throttle((event, worldPos) => {
    // Heavy computation
  }, 16), // 60fps
  
  // Memoized calculations
  private: {
    getComplexValue: memoize((input) => {
      // Expensive calculation
      return result;
    })
  }
});

// 2. State更新の最適化
const efficientTool = createStatefulTool({
  id: 'efficient',
  name: 'Efficient Tool',
  
  // バッチ更新
  actions: {
    updateMultiple: batch((ctx, events) => {
      // Process multiple updates at once
    })
  }
});

// 3. メモリ管理
const memoryEfficientTool = createTool({
  id: 'memory-efficient',
  name: 'Memory Efficient Tool',
  
  // WeakMapでリソース管理
  private: {
    cache: new WeakMap(),
    
    cleanup() {
      // Automatic garbage collection
    }
  }
});
```

## 🔒 Security Considerations

### サンドボックス化

```typescript
import { sandboxTool } from '@usketch/drawing-tools/security';

// サードパーティToolのサンドボックス化
const sandboxedTool = sandboxTool(untrustedTool, {
  // 許可する操作
  allow: ['read', 'draw'],
  
  // 禁止する操作
  deny: ['write', 'delete', 'network'],
  
  // リソース制限
  limits: {
    memory: '10MB',
    cpu: '50%',
    timeout: 5000 // 5秒
  }
});
```

## 📚 Examples

### Complete Example: Rich Text Tool

```typescript
import { 
  createStatefulTool,
  withCapabilities,
  ToolContext 
} from '@usketch/drawing-tools';

const richTextTool = withCapabilities(
  createStatefulTool({
    id: 'rich-text',
    name: 'Rich Text Tool',
    
    states: {
      idle: {
        cursor: 'text',
        on: {
          POINTER_DOWN: 'placing'
        }
      },
      placing: {
        cursor: 'crosshair',
        entry: 'showPlaceholder',
        exit: 'hidePlaceholder',
        on: {
          POINTER_UP: 'editing',
          ESCAPE: 'idle'
        }
      },
      editing: {
        cursor: 'text',
        entry: 'focusEditor',
        on: {
          BLUR: 'idle',
          SAVE: {
            target: 'idle',
            actions: 'saveText'
          }
        }
      }
    },
    
    initialState: 'idle',
    
    context: {
      placeholder: null,
      editor: null,
      content: '',
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        color: '#000000',
        bold: false,
        italic: false
      }
    },
    
    actions: {
      showPlaceholder(ctx, event) {
        ctx.placeholder = createPlaceholder(event.worldPos);
      },
      
      hidePlaceholder(ctx) {
        removePlaceholder(ctx.placeholder);
        ctx.placeholder = null;
      },
      
      focusEditor(ctx) {
        ctx.editor = createEditor(ctx.placeholder.position);
        ctx.editor.focus();
      },
      
      saveText(ctx) {
        const text = createTextShape({
          content: ctx.content,
          style: ctx.style,
          position: ctx.editor.position
        });
        
        addShapeToCanvas(text);
        removeEditor(ctx.editor);
        ctx.editor = null;
      }
    }
  }),
  
  // 追加能力
  ['undo', 'redo', 'copy', 'paste', 'style']
);
```

---

*このドキュメントは、uSketch Tool System API の完全な仕様を定義しています。*
*最終更新: 2025-01-14*