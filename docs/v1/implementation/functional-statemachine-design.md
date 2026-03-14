# Functional StateMachine Design for uSketch

## 🎯 概要

クラスベースから**関数型プログラミング**のアプローチに転換し、**XState**や**Robot**などのStateMachineライブラリを活用した、よりモダンで宣言的な設計を提案します。

## 🏗️ アーキテクチャの選択肢

### Option 1: XState (推奨)

```typescript
import { createMachine, interpret, assign } from 'xstate';

// Tool定義は純粋な設定オブジェクト
export const createSelectTool = () => createMachine({
  id: 'select',
  initial: 'idle',
  
  // コンテキスト（状態データ）
  context: {
    selectedIds: new Set<string>(),
    dragStart: null as Point | null,
    dragOffset: { x: 0, y: 0 }
  },
  
  // 状態定義
  states: {
    idle: {
      on: {
        POINTER_DOWN: [
          {
            target: 'dragging',
            cond: 'isOnShape',
            actions: 'recordDragStart'
          },
          {
            target: 'brushing',
            actions: 'startBrushSelection'
          }
        ]
      }
    },
    
    dragging: {
      on: {
        POINTER_MOVE: {
          actions: 'updateDragPosition'
        },
        POINTER_UP: {
          target: 'idle',
          actions: 'completeDrag'
        },
        ESCAPE: {
          target: 'idle',
          actions: 'cancelDrag'
        }
      }
    },
    
    brushing: {
      on: {
        POINTER_MOVE: {
          actions: 'updateBrushSelection'
        },
        POINTER_UP: {
          target: 'idle',
          actions: 'completeBrushSelection'
        }
      }
    }
  }
}, {
  // アクション定義（純粋関数）
  actions: {
    recordDragStart: assign({
      dragStart: (_, event) => event.point
    }),
    
    updateDragPosition: assign({
      dragOffset: (context, event) => ({
        x: event.point.x - context.dragStart!.x,
        y: event.point.y - context.dragStart!.y
      })
    }),
    
    completeDrag: (context, event, { state }) => {
      // 副作用はここで実行
      commitShapePositions(context.selectedIds, context.dragOffset);
    }
  },
  
  // ガード条件（純粋関数）
  guards: {
    isOnShape: (context, event) => {
      return !!getShapeAtPoint(event.point);
    }
  }
});
```

### Option 2: Robot (軽量な選択肢)

```typescript
import { createMachine, state, transition } from 'robot3';

export const createPenTool = () => {
  // 状態定義（関数の組み合わせ）
  return createMachine({
    idle: state(
      transition('START_DRAWING', 'drawing',
        // アクション: コンテキストを返す純粋関数
        (context, event) => ({
          ...context,
          currentStroke: [event.point]
        })
      )
    ),
    
    drawing: state(
      transition('ADD_POINT', 'drawing',
        (context, event) => ({
          ...context,
          currentStroke: [...context.currentStroke, event.point]
        })
      ),
      transition('FINISH', 'idle',
        (context) => {
          saveStroke(context.currentStroke);
          return { ...context, currentStroke: [] };
        }
      ),
      transition('CANCEL', 'idle',
        (context) => ({ ...context, currentStroke: [] })
      )
    )
  }, 
  // 初期コンテキスト
  () => ({ currentStroke: [] })
  );
};
```

### Option 3: カスタム軽量実装

```typescript
// 最小限のStateMachine実装
type StateConfig<TContext> = {
  on?: Record<string, string | TransitionConfig<TContext>>;
  entry?: Action<TContext>;
  exit?: Action<TContext>;
  always?: TransitionConfig<TContext>;
};

type TransitionConfig<TContext> = {
  target?: string;
  cond?: Guard<TContext>;
  actions?: Action<TContext> | Action<TContext>[];
};

type Action<TContext> = (context: TContext, event: any) => TContext | void;
type Guard<TContext> = (context: TContext, event: any) => boolean;

export function createStateMachine<TContext>(config: {
  id: string;
  initial: string;
  context: TContext;
  states: Record<string, StateConfig<TContext>>;
}) {
  let currentState = config.initial;
  let context = { ...config.context };
  
  const transition = (eventType: string, eventData?: any) => {
    const stateConfig = config.states[currentState];
    const transition = stateConfig?.on?.[eventType];
    
    if (!transition) return;
    
    const targetConfig = typeof transition === 'string' 
      ? { target: transition }
      : transition;
    
    // ガード条件チェック
    if (targetConfig.cond && !targetConfig.cond(context, eventData)) {
      return;
    }
    
    // Exit action
    if (stateConfig.exit) {
      const result = stateConfig.exit(context, eventData);
      if (result) context = result;
    }
    
    // Transition actions
    if (targetConfig.actions) {
      const actions = Array.isArray(targetConfig.actions) 
        ? targetConfig.actions 
        : [targetConfig.actions];
      
      for (const action of actions) {
        const result = action(context, eventData);
        if (result) context = result;
      }
    }
    
    // 状態遷移
    if (targetConfig.target) {
      currentState = targetConfig.target;
      
      // Entry action
      const newStateConfig = config.states[currentState];
      if (newStateConfig.entry) {
        const result = newStateConfig.entry(context, eventData);
        if (result) context = result;
      }
    }
  };
  
  return {
    transition,
    getState: () => currentState,
    getContext: () => context,
    matches: (state: string) => currentState === state
  };
}
```

## 🎨 Function-Based Tool API

### 1. Tool Factory Functions

```typescript
import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';

// === Tool定義（純粋な関数） ===
export const createDrawingTool = (config: ToolConfig) => {
  const machine = createMachine({
    id: config.id,
    initial: 'idle',
    
    context: {
      stroke: null as Stroke | null,
      style: config.defaultStyle || {
        color: '#000000',
        width: 2
      }
    },
    
    states: {
      idle: {
        on: {
          START: {
            target: 'drawing',
            actions: assign({
              stroke: (_, event) => ({
                points: [event.point],
                style: event.style
              })
            })
          }
        }
      },
      
      drawing: {
        on: {
          MOVE: {
            actions: assign({
              stroke: (ctx, event) => ({
                ...ctx.stroke!,
                points: [...ctx.stroke!.points, event.point]
              })
            })
          },
          END: {
            target: 'idle',
            actions: [
              (ctx) => config.onComplete?.(ctx.stroke!),
              assign({ stroke: null })
            ]
          }
        }
      }
    }
  });
  
  return machine;
};

// === React Hook for Tool ===
export const useDrawingTool = (config: ToolConfig) => {
  const machine = useMemo(() => createDrawingTool(config), [config]);
  const [state, send] = useMachine(machine);
  
  // イベントハンドラーを返す
  const handlers = useMemo(() => ({
    onPointerDown: (e: PointerEvent, point: Point) => {
      send({ type: 'START', point, style: config.defaultStyle });
    },
    
    onPointerMove: (e: PointerEvent, point: Point) => {
      send({ type: 'MOVE', point });
    },
    
    onPointerUp: (e: PointerEvent) => {
      send({ type: 'END' });
    }
  }), [send, config]);
  
  return {
    state: state.value,
    context: state.context,
    handlers,
    isDrawing: state.matches('drawing')
  };
};
```

### 2. Composable Tool Functions

```typescript
// === 機能の合成（Higher-Order Functions） ===

// スナップ機能を追加
export const withSnapping = (createTool: ToolFactory) => (config: ToolConfig) => {
  const baseMachine = createTool(config);
  
  return baseMachine.withConfig({
    actions: {
      ...baseMachine.options.actions,
      
      // MOVEアクションをラップ
      updatePosition: (context, event) => {
        const snappedPoint = snapToGrid(event.point, config.gridSize || 10);
        return baseMachine.options.actions.updatePosition(
          context,
          { ...event, point: snappedPoint }
        );
      }
    }
  });
};

// ガイドライン機能を追加
export const withGuidelines = (createTool: ToolFactory) => (config: ToolConfig) => {
  const baseMachine = createTool(config);
  
  return baseMachine.withConfig({
    states: {
      ...baseMachine.config.states,
      
      // 各状態にガイドライン表示を追加
      drawing: {
        ...baseMachine.config.states.drawing,
        entry: [
          ...(baseMachine.config.states.drawing.entry || []),
          () => showGuidelines()
        ],
        exit: [
          ...(baseMachine.config.states.drawing.exit || []),
          () => hideGuidelines()
        ]
      }
    }
  });
};

// 使用例：機能を組み合わせる
const createSmartDrawingTool = pipe(
  withSnapping,
  withGuidelines,
  withHistory
)(createDrawingTool);
```

### 3. Tool Manager (Functional)

```typescript
// === Tool Manager（関数型） ===
export const createToolManager = () => {
  const tools = new Map<string, StateMachine<any, any, any>>();
  let currentTool: string | null = null;
  let currentService: any = null;
  
  const register = (id: string, factory: ToolFactory, config?: ToolConfig) => {
    tools.set(id, factory(config || {}));
  };
  
  const activate = (id: string) => {
    // 現在のToolを停止
    if (currentService) {
      currentService.stop();
    }
    
    const machine = tools.get(id);
    if (!machine) throw new Error(`Tool ${id} not found`);
    
    currentTool = id;
    currentService = interpret(machine).start();
    
    return currentService;
  };
  
  const send = (event: any) => {
    if (currentService) {
      currentService.send(event);
    }
  };
  
  const getCurrentState = () => {
    return currentService?.state;
  };
  
  return {
    register,
    activate,
    send,
    getCurrentState,
    tools: () => Array.from(tools.keys())
  };
};
```

### 4. Event System (Functional)

```typescript
// === イベント変換（純粋関数） ===
export const createEventAdapter = () => {
  const pointerEventToToolEvent = (
    e: PointerEvent,
    type: 'START' | 'MOVE' | 'END'
  ): ToolEvent => ({
    type,
    point: screenToWorld({ x: e.clientX, y: e.clientY }),
    pressure: e.pressure || 1,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    timestamp: Date.now()
  });
  
  const keyboardEventToToolEvent = (
    e: KeyboardEvent,
    type: 'KEY_DOWN' | 'KEY_UP'
  ): ToolEvent => ({
    type,
    key: e.key,
    code: e.code,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    timestamp: Date.now()
  });
  
  return {
    pointerEventToToolEvent,
    keyboardEventToToolEvent
  };
};

// === イベントハンドラー登録（副作用を分離） ===
export const attachToolEvents = (
  element: HTMLElement,
  toolManager: ReturnType<typeof createToolManager>
) => {
  const adapter = createEventAdapter();
  
  const handlers = {
    pointerdown: (e: PointerEvent) => {
      toolManager.send(adapter.pointerEventToToolEvent(e, 'START'));
    },
    pointermove: (e: PointerEvent) => {
      toolManager.send(adapter.pointerEventToToolEvent(e, 'MOVE'));
    },
    pointerup: (e: PointerEvent) => {
      toolManager.send(adapter.pointerEventToToolEvent(e, 'END'));
    },
    keydown: (e: KeyboardEvent) => {
      toolManager.send(adapter.keyboardEventToToolEvent(e, 'KEY_DOWN'));
    }
  };
  
  // イベントリスナー登録
  Object.entries(handlers).forEach(([event, handler]) => {
    element.addEventListener(event, handler as any);
  });
  
  // クリーンアップ関数を返す
  return () => {
    Object.entries(handlers).forEach(([event, handler]) => {
      element.removeEventListener(event, handler as any);
    });
  };
};
```

### 5. 階層的状態（Nested States）

```typescript
// === XStateの階層的状態 ===
export const createAdvancedSelectTool = () => createMachine({
  id: 'select',
  initial: 'idle',
  
  states: {
    idle: {
      on: {
        POINTER_DOWN: [
          { target: 'selecting.brushing', cond: 'isOnCanvas' },
          { target: 'selecting.translating', cond: 'isOnShape' }
        ]
      }
    },
    
    // 親状態
    selecting: {
      initial: 'brushing',
      
      // 共通のイベントハンドラー
      on: {
        ESCAPE: 'idle'
      },
      
      // 子状態
      states: {
        brushing: {
          on: {
            POINTER_MOVE: { actions: 'updateBrush' },
            POINTER_UP: '#select.idle'  // 絶対パスで遷移
          }
        },
        
        translating: {
          on: {
            POINTER_MOVE: { actions: 'updatePosition' },
            POINTER_UP: '#select.idle'
          }
        },
        
        // ネストした階層
        cropping: {
          initial: 'idle',
          
          states: {
            idle: {
              on: {
                POINTER_DOWN: 'adjusting'
              }
            },
            adjusting: {
              on: {
                POINTER_MOVE: { actions: 'adjustCrop' },
                POINTER_UP: 'idle'
              }
            }
          },
          
          on: {
            COMPLETE: '#select.idle',
            CANCEL: '#select.idle'
          }
        }
      }
    }
  }
});
```

### 6. React統合

```typescript
// === React Component ===
export const WhiteboardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const toolManager = useRef(createToolManager());
  
  // 現在のToolの状態
  const [currentTool, setCurrentTool] = useState('select');
  const [toolState, setToolState] = useState<any>(null);
  
  // Tool切り替え
  const switchTool = useCallback((toolId: string) => {
    const service = toolManager.current.activate(toolId);
    
    // 状態変更を監視
    service.onTransition((state) => {
      setToolState(state);
    });
    
    setCurrentTool(toolId);
  }, []);
  
  // イベントハンドラー設定
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const cleanup = attachToolEvents(
      canvasRef.current,
      toolManager.current
    );
    
    return cleanup;
  }, []);
  
  // Tool登録
  useEffect(() => {
    toolManager.current.register('select', createAdvancedSelectTool);
    toolManager.current.register('pen', createPenTool);
    toolManager.current.register('rectangle', createRectangleTool);
    
    // デフォルトToolをアクティベート
    switchTool('select');
  }, [switchTool]);
  
  return (
    <div>
      <Toolbar 
        currentTool={currentTool}
        onToolChange={switchTool}
      />
      <div 
        ref={canvasRef}
        className="whiteboard-canvas"
        data-tool={currentTool}
        data-state={toolState?.value}
      />
    </div>
  );
};
```

### 7. テスト

```typescript
// === 純粋関数のテスト ===
import { createMachine, interpret } from 'xstate';

describe('Drawing Tool', () => {
  it('should transition states correctly', () => {
    const machine = createDrawingTool({ id: 'test' });
    const service = interpret(machine).start();
    
    // 初期状態
    expect(service.state.value).toBe('idle');
    
    // 描画開始
    service.send({ type: 'START', point: { x: 0, y: 0 } });
    expect(service.state.value).toBe('drawing');
    expect(service.state.context.stroke).toBeTruthy();
    
    // ポイント追加
    service.send({ type: 'MOVE', point: { x: 10, y: 10 } });
    expect(service.state.context.stroke.points).toHaveLength(2);
    
    // 描画終了
    service.send({ type: 'END' });
    expect(service.state.value).toBe('idle');
    expect(service.state.context.stroke).toBeNull();
  });
});

// === 合成関数のテスト ===
describe('Tool Composition', () => {
  it('should add snapping behavior', () => {
    const snappingTool = withSnapping(createDrawingTool)({
      id: 'snapping-tool',
      gridSize: 10
    });
    
    const service = interpret(snappingTool).start();
    
    service.send({ type: 'START', point: { x: 12, y: 17 } });
    service.send({ type: 'MOVE', point: { x: 23, y: 28 } });
    
    // スナップされた座標を確認
    const points = service.state.context.stroke.points;
    expect(points[0]).toEqual({ x: 10, y: 20 });  // snapped
    expect(points[1]).toEqual({ x: 20, y: 30 });  // snapped
  });
});
```

## 🎯 メリット

### 1. **純粋性**
- 状態遷移ロジックが純粋関数
- テストが簡単
- 予測可能な動作

### 2. **宣言的**
- 状態遷移を宣言的に記述
- 可読性が高い
- メンテナンスが容易

### 3. **合成可能**
- Higher-Order Functionsで機能追加
- パイプラインで組み合わせ
- 再利用性が高い

### 4. **軽量**
- クラスのオーバーヘッドなし
- Tree-shakingが効く
- バンドルサイズ削減

### 5. **型安全**
- TypeScriptの型推論が効く
- XStateのtypegen対応
- 実行時エラー削減

## 📦 推奨ライブラリ

1. **XState** (25KB) - フル機能、可視化ツールあり
2. **Robot** (3KB) - 超軽量、シンプル
3. **Zag** (10KB) - UIコンポーネント特化
4. **自作** (1KB) - 最小限の実装

プロジェクトの規模と要件に応じて選択してください。

---

*最終更新: 2025-01-14*