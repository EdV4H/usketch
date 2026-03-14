# XState-Based Tool System Design for uSketch

## 🎯 概要

uSketchのToolシステムを**XState v5**で完全に再設計します。XState v5の新機能（改善されたTypeScript統合、新しいActor API、簡略化されたsetup API）を活用し、複雑なインタラクションを宣言的に管理します。

## 📦 依存関係

```json
{
  "dependencies": {
    "xstate": "^5.18.0",
    "@xstate/react": "^4.1.0"
  },
  "devDependencies": {
    "@xstate/cli": "^0.5.0",
    "@xstate/inspect": "^0.8.0",
    "@xstate/test": "^1.0.0"
  }
}
```

## 🆕 XState v5の主な変更点

### 1. **Setup API**
- `createMachine`の代わりに`setup()`を使用して型安全性を向上
- コンテキスト、イベント、アクション、ガードの型を事前定義

### 2. **Actor API**
- `spawn`が`createActor`に変更
- より直感的なActor間通信

### 3. **TypeScript改善**
- 型推論の大幅な改善
- `tsTypes`や`schema`が不要に

### 4. **簡略化されたAPI**
- `predictableActionArguments`と`preserveActionOrder`がデフォルトで有効
- `services`が`actors`に名称変更

## 🏗️ Core Architecture (XState v5)

### 1. Tool Machine Factory with Setup API

```typescript
import { setup, assign, createActor, fromCallback } from 'xstate';
import type { Point, Shape, Bounds } from '@usketch/shared-types';

// === 共通の型定義 ===
export interface ToolContext {
  // 共通プロパティ
  cursor: string;
  selectedIds: Set<string>;
  hoveredId: string | null;
  
  // Tool固有のデータはジェネリクスで拡張
  [key: string]: any;
}

export interface ToolEvent {
  type: string;
  point?: Point;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

// === XState v5: Setup API を使用したTool Machine Factory ===
export function createToolMachine<
  TContext extends ToolContext = ToolContext,
  TEvent extends ToolEvent = ToolEvent
>(config: {
  id: string;
  context?: Partial<TContext>;
  states: any;
  actions?: Record<string, any>;
  guards?: Record<string, any>;
  actors?: Record<string, any>; // v5: services → actors
}) {
  // v5: setup APIで型安全性を向上
  return setup({
    types: {
      context: {} as TContext,
      events: {} as TEvent,
    },
    actions: config.actions || {},
    guards: config.guards || {},
    actors: config.actors || {}, // v5: services → actors
  }).createMachine({
    id: config.id,
    
    context: {
      cursor: 'default',
      selectedIds: new Set(),
      hoveredId: null,
      ...config.context,
    } as TContext,
    
    states: config.states,
  });
}
```

### 2. Select Tool Implementation

```typescript
// === Select Tool Context ===
interface SelectToolContext extends ToolContext {
  dragStart: Point | null;
  dragOffset: Point;
  selectionBox: Bounds | null;
  initialPositions: Map<string, Point>;
}

// === Select Tool Events ===
type SelectToolEvent = 
  | { type: 'POINTER_DOWN'; point: Point; target?: string }
  | { type: 'POINTER_MOVE'; point: Point }
  | { type: 'POINTER_UP'; point: Point }
  | { type: 'DOUBLE_CLICK'; point: Point; target?: string }
  | { type: 'KEY_DOWN'; key: string }
  | { type: 'ESCAPE' }
  | { type: 'DELETE' }
  | { type: 'ENTER_CROP_MODE'; shapeId: string };

// === Select Tool Machine (XState v5) ===
export const selectToolMachine = setup({
  types: {
    context: {} as SelectToolContext,
    events: {} as SelectToolEvent,
  },
  actions: {
    resetCursor: assign({
      cursor: 'default'
    }),
    
    setCursorMove: assign({
      cursor: 'move'
    }),
    
    startTranslating: assign(({ event }) => ({
      dragStart: event.point,
      dragOffset: { x: 0, y: 0 }
    })),
    
    // その他のアクションは後述
  },
  guards: {
    isPointOnShape: ({ event }) => {
      return !!getShapeAtPoint(event.point);
    },
    
    isPointOnSelectedShape: ({ context, event }) => {
      const shape = getShapeAtPoint(event.point);
      return shape ? context.selectedIds.has(shape.id) : false;
    },
    
    // その他のガードは後述
  },
  actors: {
    snappingService: fromCallback(({ sendBack, receive }) => {
      const snapEngine = new SnapEngine();
      
      receive((event) => {
        if (event.type === 'UPDATE_POSITION') {
          const snapped = snapEngine.snap(event.position);
          sendBack({ type: 'SNAPPED', position: snapped });
        }
      });
      
      return () => {
        snapEngine.cleanup();
      };
    })
  }
}).createMachine({
  id: 'selectTool',
  
  context: {
    dragStart: null,
    dragOffset: { x: 0, y: 0 },
    selectionBox: null,
    initialPositions: new Map(),
    cursor: 'default',
    selectedIds: new Set(),
    hoveredId: null,
  },
  
  states: {
    idle: {
      entry: 'resetCursor',
      on: {
        POINTER_DOWN: [
          {
            target: 'translating',
            guard: 'isPointOnSelectedShape', // v5: cond → guard
            actions: 'startTranslating'
          },
          {
            target: 'selecting.single',
            guard: 'isPointOnShape', // v5: cond → guard
            actions: 'selectShape'
          },
          {
            target: 'selecting.brush',
            actions: 'startBrushSelection'
          }
        ],
        
        DOUBLE_CLICK: {
          target: 'cropping',
          guard: 'isPointOnShape', // v5: cond → guard
          actions: 'enterCropMode'
        },
        
        DELETE: {
          actions: 'deleteSelectedShapes'
        }
      }
    },
    
    // === 階層的状態: 選択モード ===
    selecting: {
      initial: 'single',
      
      states: {
        single: {
          on: {
            POINTER_UP: {
              target: '#selectTool.idle'
            }
          }
        },
        
        brush: {
          entry: 'showSelectionBox',
          exit: 'hideSelectionBox',
          
          on: {
            POINTER_MOVE: {
              actions: 'updateSelectionBox'
            },
            POINTER_UP: {
              target: '#selectTool.idle',
              actions: 'finalizeSelection'
            }
          }
        }
      },
      
      on: {
        ESCAPE: {
          target: 'idle',
          actions: 'clearSelection'
        }
      }
    },
    
    // === ドラッグ状態 ===
    translating: {
      entry: ['setCursorMove', 'recordInitialPositions'],
      exit: 'commitTranslation',
      
      on: {
        POINTER_MOVE: {
          actions: 'updateTranslation'
        },
        POINTER_UP: {
          target: 'idle'
        },
        ESCAPE: {
          target: 'idle',
          actions: 'cancelTranslation'
        }
      },
      
      // === v5: Invoke Actor for snapping ===
      invoke: {
        id: 'snappingService',
        src: 'snappingService', // actors内で定義
        input: ({ context }) => ({ // v5: data → input
          shapes: context.selectedIds,
          threshold: 10
        })
      }
    },
    
    // === 並列状態: Crop Mode ===
    cropping: {
      type: 'parallel',
      
      states: {
        crop: {
          initial: 'idle',
          
          states: {
            idle: {
              on: {
                POINTER_DOWN: {
                  target: 'adjusting',
                  guard: 'isPointOnCropHandle' // v5: cond → guard
                }
              }
            },
            
            adjusting: {
              on: {
                POINTER_MOVE: {
                  actions: 'adjustCropBounds'
                },
                POINTER_UP: {
                  target: 'idle'
                }
              }
            }
          }
        },
        
        overlay: {
          initial: 'visible',
          
          states: {
            visible: {
              entry: 'showCropOverlay'
            },
            hidden: {
              entry: 'hideCropOverlay'
            }
          }
        }
      },
      
      on: {
        ESCAPE: {
          target: 'idle',
          actions: 'exitCropMode'
        },
        ENTER: {
          target: 'idle',
          actions: 'applyCrop'
        }
      }
    }
  }
});

// Note: 上記のsetup内でactionsの一部のみ定義し、残りのactionsの実装例を以下に示す
// 実際の実装では、これらもsetup内のactionsに含める

const additionalActions = {
  recordInitialPositions: assign(({ context }) => {
    const positions = new Map<string, Point>();
    context.selectedIds.forEach(id => {
      const shape = getShape(id);
      if (shape) {
        positions.set(id, { x: shape.x, y: shape.y });
      }
    });
    return { initialPositions: positions };
  }),
  
  updateTranslation: assign(({ context, event }) => {
    if (!context.dragStart) return {};
    
    const offset = {
      x: event.point.x - context.dragStart.x,
      y: event.point.y - context.dragStart.y
    };
    
    // Apply translation to all selected shapes
    context.selectedIds.forEach(id => {
      const initial = context.initialPositions.get(id);
      if (initial) {
        updateShape(id, {
          x: initial.x + offset.x,
          y: initial.y + offset.y
        });
      }
    });
    
    return { dragOffset: offset };
  }),
  
  commitTranslation: ({ context }) => {
    commitShapeChanges();
  },
  
  cancelTranslation: ({ context }) => {
    // Restore original positions
    context.initialPositions.forEach((pos, id) => {
      updateShape(id, pos);
    });
  },
  
  startBrushSelection: assign(({ event }) => ({
    selectionBox: {
      x: event.point.x,
      y: event.point.y,
      width: 0,
      height: 0
    }
  })),
  
  updateSelectionBox: assign(({ context, event }) => {
    if (!context.selectionBox) return {};
    
    const box = {
      x: Math.min(context.selectionBox.x, event.point.x),
      y: Math.min(context.selectionBox.y, event.point.y),
      width: Math.abs(event.point.x - context.selectionBox.x),
      height: Math.abs(event.point.y - context.selectionBox.y)
    };
    
    // Update selected shapes based on intersection
    const intersecting = getShapesInBounds(box);
    
    return {
      selectionBox: box,
      selectedIds: new Set(intersecting.map(s => s.id))
    };
  })
};
```

### 3. Drawing Tool Implementation

```typescript
// === Drawing Tool Context ===
interface DrawingToolContext extends ToolContext {
  currentStroke: Point[];
  strokeStyle: {
    color: string;
    width: number;
    opacity: number;
  };
  isDrawing: boolean;
  pressure: number;
}

// === Drawing Tool Machine (XState v5) ===
export const drawingToolMachine = setup({
  types: {
    context: {} as DrawingToolContext,
    events: {} as DrawingToolEvent,
  },
  actions: {
    startStroke: assign(({ event }) => ({
      currentStroke: [event.point],
      cursor: 'crosshair'
    })),
    
    addPoint: assign(({ context, event }) => ({
      currentStroke: [...context.currentStroke, event.point]
    })),
    
    addSmoothPoint: assign(({ context, event }) => {
      // Apply smoothing algorithm
      const smoothed = smoothPath(
        [...context.currentStroke, event.point],
        0.5
      );
      return { currentStroke: smoothed };
    }),
    
    updateStraightLine: assign(({ context, event }) => {
      if (context.currentStroke.length === 0) return {};
      
      // Keep only first and current point for straight line
      return {
        currentStroke: [
          context.currentStroke[0],
          event.point
        ]
      };
    }),
    
    finalizeStroke: ({ context }) => {
      if (context.currentStroke.length > 1) {
        createShape({
          type: 'path',
          points: context.currentStroke,
          style: context.strokeStyle
        });
      }
    },
    
    cancelStroke: assign({
      currentStroke: []
    }),
    
    resetStroke: assign({
      currentStroke: [],
      cursor: 'crosshair'
    })
  },
  actors: {
    smoothingService: fromCallback(({ sendBack }) => {
      const interval = setInterval(() => {
        sendBack({ type: 'SMOOTH_TICK' });
      }, 16); // 60fps
      
      return () => clearInterval(interval);
    })
  }
}).createMachine({
  id: 'drawingTool',
  
  context: {
    currentStroke: [],
    strokeStyle: {
      color: '#000000',
      width: 2,
      opacity: 1
    },
    isDrawing: false,
    pressure: 1
  },
  
  states: {
    idle: {
      entry: 'resetStroke',
      on: {
        POINTER_DOWN: {
          target: 'drawing',
          actions: 'startStroke'
        },
        
        // Style changes
        SET_COLOR: {
          actions: assign({
            strokeStyle: (ctx, event) => ({
              ...ctx.strokeStyle,
              color: event.color
            })
          })
        },
        SET_WIDTH: {
          actions: assign({
            strokeStyle: (ctx, event) => ({
              ...ctx.strokeStyle,
              width: event.width
            })
          })
        }
      }
    },
    
    drawing: {
      entry: assign({ isDrawing: true }),
      exit: assign({ isDrawing: false }),
      
      // === Nested states for drawing modes ===
      initial: 'freehand',
      
      states: {
        freehand: {
          on: {
            POINTER_MOVE: {
              actions: 'addPoint'
            }
          }
        },
        
        straight: {
          on: {
            POINTER_MOVE: {
              actions: 'updateStraightLine'
            }
          }
        },
        
        smooth: {
          invoke: {
            id: 'smoothingService',
            src: 'smoothingService'
          },
          on: {
            POINTER_MOVE: {
              actions: 'addSmoothPoint'
            }
          }
        }
      },
      
      on: {
        POINTER_UP: {
          target: 'idle',
          actions: 'finalizeStroke'
        },
        
        PRESSURE_CHANGE: {
          actions: assign({
            pressure: ({ event }) => event.pressure // v5: 引数の構造が変更
          })
        },
        
        // Mode switches
        TOGGLE_STRAIGHT: '.straight',
        TOGGLE_SMOOTH: '.smooth',
        TOGGLE_FREEHAND: '.freehand',
        
        ESCAPE: {
          target: 'idle',
          actions: 'cancelStroke'
        }
      }
    }
  }
});
```

### 4. Tool Manager with XState v5

```typescript
import { setup, createActor, assign, spawnChild, stopChild } from 'xstate';
import type { ActorRefFrom } from 'xstate';

// === Tool Registry Machine (XState v5) ===
interface ToolManagerContext {
  availableTools: Map<string, any>;
  currentToolId: string | null;
  currentToolActor: ActorRefFrom<any> | null;
  toolHistory: string[];
}

type ToolManagerEvent =
  | { type: 'REGISTER_TOOL'; id: string; machine: any }
  | { type: 'ACTIVATE_TOOL'; toolId: string }
  | { type: 'SWITCH_TOOL'; toolId: string }
  | { type: 'FORWARD_EVENT'; payload: any }
  | { type: 'DEACTIVATE' };

export const toolManagerMachine = setup({
  types: {
    context: {} as ToolManagerContext,
    events: {} as ToolManagerEvent,
  },
  actions: {
    registerTool: assign(({ context, event }) => {
      if (event.type === 'REGISTER_TOOL') {
        context.availableTools.set(event.id, event.machine);
      }
      return context;
    }),
    
    activateTool: assign(({ context, event, spawn }) => {
      if (event.type !== 'ACTIVATE_TOOL' && event.type !== 'SWITCH_TOOL') return context;
      
      const toolId = event.type === 'ACTIVATE_TOOL' ? event.toolId : event.toolId;
      const machine = context.availableTools.get(toolId);
      if (!machine) {
        console.error(`Tool ${toolId} not found`);
        return context;
      }
      
      // Stop current tool if exists
      if (context.currentToolActor) {
        stopChild(context.currentToolActor); // v5: actor.stop() → stopChild
      }
      
      // Spawn new tool actor
      const actor = spawnChild(machine, { id: toolId }); // v5: spawn → spawnChild
      
      return {
        ...context,
        currentToolId: toolId,
        currentToolActor: actor,
        toolHistory: [...context.toolHistory, toolId]
      };
    }),
    
    deactivateCurrentTool: assign(({ context }) => {
      if (context.currentToolActor) {
        stopChild(context.currentToolActor); // v5: actor.stop() → stopChild
      }
      
      return {
        ...context,
        currentToolActor: null
      };
    }),
    
    forwardToTool: ({ context, event }) => {
      if (event.type === 'FORWARD_EVENT' && context.currentToolActor) {
        context.currentToolActor.send(event.payload);
      }
    }
  }
}).createMachine({
  id: 'toolManager',
  
  context: {
    availableTools: new Map(),
    currentToolId: null,
    currentToolActor: null,
    toolHistory: []
  } as ToolManagerContext,
  
  initial: 'idle',
  
  states: {
    idle: {
      on: {
        REGISTER_TOOL: {
          actions: 'registerTool'
        },
        
        ACTIVATE_TOOL: {
          target: 'active',
          actions: 'activateTool'
        }
      }
    },
    
    active: {
      on: {
        SWITCH_TOOL: {
          actions: ['deactivateCurrentTool', 'activateTool']
        },
        
        FORWARD_EVENT: {
          actions: 'forwardToTool'
        },
        
        DEACTIVATE: {
          target: 'idle',
          actions: 'deactivateCurrentTool'
        }
      }
    }
  }
});

// === Tool Manager Service (XState v5) ===
export class ToolManager {
  private actor: any; // v5: service → actor
  
  constructor() {
    this.actor = createActor(toolManagerMachine) // v5: interpret → createActor
    this.actor.subscribe((state) => {
      console.log('Tool Manager:', state.value);
    });
    this.actor.start(); // v5: start()は別で呼ぶ
    
    // Register default tools
    this.registerDefaultTools();
  }
  
  private registerDefaultTools() {
    this.register('select', selectToolMachine);
    this.register('draw', drawingToolMachine);
    this.register('rectangle', rectangleToolMachine);
    this.register('ellipse', ellipseToolMachine);
    this.register('arrow', arrowToolMachine);
    this.register('text', textToolMachine);
  }
  
  register(id: string, machine: any) {
    this.actor.send({ type: 'REGISTER_TOOL', id, machine });
  }
  
  activate(toolId: string) {
    this.actor.send({ type: 'ACTIVATE_TOOL', toolId });
  }
  
  send(event: any) {
    this.actor.send({ type: 'FORWARD_EVENT', payload: event });
  }
  
  getCurrentTool() {
    return this.actor.getSnapshot().context.currentToolId; // v5: state → getSnapshot()
  }
}
```

### 5. React Integration (XState v5)

```typescript
import { useActor, useSelector } from '@xstate/react';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { createActor } from 'xstate';

// === XState v5 React Hook ===
export function useToolMachine(toolId: string) {
  // v5: useMachine → useActor with createActor
  const toolMachine = useMemo(() => {
    switch (toolId) {
      case 'select':
        return selectToolMachine;
      case 'draw':
        return drawingToolMachine;
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  }, [toolId]);

  const toolActor = useMemo(() => createActor(toolMachine), [toolMachine]);
  const [state, send] = useActor(toolActor);
  
  const handlers = useCallback(() => ({
    onPointerDown: (e: PointerEvent) => {
      const point = screenToWorld({ x: e.clientX, y: e.clientY });
      send({ 
        type: 'POINTER_DOWN', 
        point,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey 
      });
    },
    
    onPointerMove: (e: PointerEvent) => {
      const point = screenToWorld({ x: e.clientX, y: e.clientY });
      send({ type: 'POINTER_MOVE', point });
    },
    
    onPointerUp: (e: PointerEvent) => {
      const point = screenToWorld({ x: e.clientX, y: e.clientY });
      send({ type: 'POINTER_UP', point });
    },
    
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        send({ type: 'DELETE' });
      } else {
        send({ type: 'KEY_DOWN', key: e.key });
      }
    }
  }), [send]);
  
  return {
    state: state.value,
    context: state.context,
    send,
    handlers: handlers(),
    isIn: (stateValue: string) => state.matches(stateValue)
  };
}

// === Whiteboard Component ===
export const Whiteboard: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [currentTool, setCurrentTool] = useState('select');
  
  const { state, context, handlers, isIn } = useToolMachine(currentTool);
  
  // Apply cursor
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = context.cursor;
    }
  }, [context.cursor]);
  
  // Debug visualization in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('@xstate/inspect').then(({ inspect }) => {
        inspect({
          iframe: false
        });
      });
    }
  }, []);
  
  return (
    <div className="whiteboard-container">
      <Toolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        toolState={state}
      />
      
      <div
        ref={canvasRef}
        className="whiteboard-canvas"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onKeyDown={handlers.onKeyDown}
        tabIndex={0}
      >
        {/* Render shapes */}
        <ShapeRenderer shapes={getShapes()} />
        
        {/* Selection box */}
        {isIn('selecting.brush') && context.selectionBox && (
          <SelectionBox bounds={context.selectionBox} />
        )}
        
        {/* Current stroke preview */}
        {isIn('drawing') && context.currentStroke.length > 0 && (
          <StrokePreview points={context.currentStroke} style={context.strokeStyle} />
        )}
        
        {/* Crop overlay */}
        {isIn('cropping') && (
          <CropOverlay shapeId={context.croppingShapeId} />
        )}
      </div>
      
      {/* State Inspector (Dev Only) */}
      {process.env.NODE_ENV === 'development' && (
        <StateInspector state={state} context={context} />
      )}
    </div>
  );
};
```

### 6. Advanced Patterns (XState v5)

```typescript
// === Spawning Child Machines (XState v5) ===
export const parentToolMachine = setup({
  types: {
    context: {} as { childActors: Map<string, any> },
    events: {} as { type: 'DELEGATE_TO_CHILD'; childId: string; payload: any }
  },
  actions: {
    spawnChildren: assign(({ spawn }) => {
      // v5: spawnはsetup内で使用
      const selectActor = spawn(selectToolMachine, { id: 'select' });
      const drawActor = spawn(drawingToolMachine, { id: 'draw' });
      
      const childActors = new Map();
      childActors.set('select', selectActor);
      childActors.set('draw', drawActor);
      
      return { childActors };
    }),
      
    delegateToChild: ({ context, event }) => {
      if (event.type === 'DELEGATE_TO_CHILD') {
        const actor = context.childActors.get(event.childId);
        actor?.send(event.payload);
      }
    }
  }
}).createMachine({
  id: 'parentTool',
  context: {
    childActors: new Map()
  },
  states: {
    active: {
      entry: 'spawnChildren',
      on: {
        DELEGATE_TO_CHILD: {
          actions: 'delegateToChild'
        }
      }
    }
  }
});

// === Model-Based Testing (XState v5) ===
import { createTestModel } from '@xstate/test'; // v5: createModel → createTestModel

const testModel = createTestModel(selectToolMachine).withEvents({
  POINTER_DOWN: { exec: async () => { /* simulate */ } },
  POINTER_MOVE: { exec: async () => { /* simulate */ } },
  POINTER_UP: { exec: async () => { /* simulate */ } }
});

describe('Select Tool', () => {
  const testPlans = testModel.getSimplePathPlans();
  
  testPlans.forEach((plan) => {
    describe(plan.description, () => {
      plan.paths.forEach((path) => {
        it(path.description, async () => {
          await path.test({
            states: {
              idle: async () => {
                expect(getState()).toBe('idle');
              },
              translating: async () => {
                expect(getState()).toBe('translating');
              }
            }
          });
        });
      });
    });
  });
});

// === Persistence & Hydration (XState v5) ===
export const persistentToolMachine = setup({
  types: {
    context: {} as any,
    events: {} as any
  },
  actions: {
    saveToLocalStorage: ({ context }) => {
      localStorage.setItem('toolState', JSON.stringify(context));
    }
  }
}).createMachine({
  id: 'persistentTool',
  
  context: {
    // Load from localStorage
    ...JSON.parse(localStorage.getItem('toolState') || '{}')
  },
  
  on: {
    '*': {
      actions: 'saveToLocalStorage' // v5: actionを外部定義
    }
  }
});

// === Time Travel Debugging (XState v5) ===
export function useTimeTravel(machine: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // v5: useMachine → useActor with createActor
  const actor = useMemo(() => createActor(machine), [machine]);
  const [state, send] = useActor(actor);
  
  useEffect(() => {
    setHistory(prev => [...prev, { state, timestamp: Date.now() }]);
    setCurrentIndex(history.length);
  }, [state]);
  
  const goBack = () => {
    if (currentIndex > 0) {
      const targetState = history[currentIndex - 1];
      send({ type: 'RESTORE', state: targetState.state });
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const goForward = () => {
    if (currentIndex < history.length - 1) {
      const targetState = history[currentIndex + 1];
      send({ type: 'RESTORE', state: targetState.state });
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  return { state, send, goBack, goForward, history };
}
```

### 7. TypeScript Integration (XState v5)

```typescript
// === Type Generation (XState v5) ===
// v5: TypeScriptサポートが大幅に改善され、typegen不要に

import type { StateFrom, EventFrom, ActorRefFrom } from 'xstate';

// Type-safe state (v5: 型推論が改善)
export type SelectToolState = StateFrom<typeof selectToolMachine>;
export type SelectToolEvent = EventFrom<typeof selectToolMachine>;
export type SelectToolActor = ActorRefFrom<typeof selectToolMachine>;
export type SelectToolSnapshot = SnapshotFrom<typeof selectToolMachine>; // v5: Snapshot型も追加

// Type guards
export function isInDrawingState(state: SelectToolState): boolean {
  return state.matches('drawing');
}

// Type-safe context access
export function getSelectedIds(state: SelectToolState): Set<string> {
  return state.context.selectedIds;
}

// Type-safe event creators
export const ToolEvents = {
  pointerDown: (point: Point): SelectToolEvent => ({
    type: 'POINTER_DOWN',
    point
  }),
  
  pointerMove: (point: Point): SelectToolEvent => ({
    type: 'POINTER_MOVE',
    point
  }),
  
  keyDown: (key: string): SelectToolEvent => ({
    type: 'KEY_DOWN',
    key
  })
} as const;
```

## 🎯 Key Benefits of XState v5

### 1. **Visualizable**
- XState Visualizer でステートマシンを可視化
- リアルタイムでの状態遷移の確認
- デバッグが容易

### 2. **Type-Safe**
- TypeScript完全対応（v5で大幅改善）
- 型推論の強化により自動型生成が不要に
- 実行時エラーの削減

### 3. **Testable**
- Model-based testing
- 全ての状態パスを自動テスト
- 決定的な動作

### 4. **Scalable**
- Actor Model
- 階層的状態
- 並列状態

### 5. **Framework Agnostic**
- React/Vue/Svelte対応
- Vanilla JSでも使用可能
- サーバーサイドでも動作

## 📊 Migration Plan (XState v5)

### Phase 1: Setup (Day 1)
```bash
# v5の最新版をインストール
npm install xstate@^5.18.0 @xstate/react@^4.1.0
# v5では型生成が不要（TypeScript統合が改善）
```

### Phase 2: Basic Tools (Day 2-3)
- SelectTool実装
- DrawingTool実装
- RectangleTool実装

### Phase 3: Advanced Features (Day 4-5)
- 階層状態の実装
- Actor Modelの活用（v5の新Actor API）
- Actors統合（v5: services → actors）

### Phase 4: Testing & Polish (Day 6-7)
- Model-based testing
- Performance optimization
- Documentation

## 🚀 Getting Started (XState v5)

```bash
# Install XState v5 dependencies
pnpm add xstate@^5.18.0 @xstate/react@^4.1.0

# v5では型生成は不要（TypeScript統合が改善）
# 以前必要だった xstate typegen は不要に

# Start development with Inspector
XSTATE_INSPECT=true pnpm dev
```

## 📚 Resources

- [XState v5 Documentation](https://stately.ai/docs/xstate)
- [XState v5 Migration Guide](https://stately.ai/docs/migration)
- [XState Visualizer](https://stately.ai/viz)
- [XState Catalogue](https://xstate-catalogue.com/)
- [Stately Studio](https://stately.ai/studio)

---

*XState v5の新機能により、より型安全で保守性の高いToolシステムが実現できます。*
*最終更新: 2025-01-15*