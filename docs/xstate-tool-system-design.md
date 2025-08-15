# XState-Based Tool System Design for uSketch

## 🎯 概要

uSketchのToolシステムを**XState**で完全に再設計します。XStateの強力な機能（階層状態、並列状態、Actor Model、TypeScript統合）を活用し、複雑なインタラクションを宣言的に管理します。

## 📦 依存関係

```json
{
  "dependencies": {
    "xstate": "^5.9.0",
    "@xstate/react": "^4.0.0"
  },
  "devDependencies": {
    "@xstate/cli": "^0.5.0",
    "@xstate/inspect": "^0.8.0",
    "@xstate/test": "^0.5.0"
  }
}
```

## 🏗️ Core Architecture

### 1. Tool Machine Factory

```typescript
import { createMachine, assign, createActor, fromCallback } from 'xstate';
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

// === Tool Machine Factory ===
export function createToolMachine<
  TContext extends ToolContext = ToolContext,
  TEvent extends ToolEvent = ToolEvent
>(config: {
  id: string;
  context?: Partial<TContext>;
  states: any;
  actions?: any;
  guards?: any;
  services?: any;
}) {
  return createMachine({
    id: config.id,
    predictableActionArguments: true,
    preserveActionOrder: true,
    tsTypes: {} as import('./tools.typegen').Typegen0,
    
    schema: {
      context: {} as TContext,
      events: {} as TEvent,
    },
    
    context: {
      cursor: 'default',
      selectedIds: new Set(),
      hoveredId: null,
      ...config.context,
    } as TContext,
    
    states: config.states,
  }, {
    actions: config.actions,
    guards: config.guards,
    services: config.services,
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

// === Select Tool Machine ===
export const selectToolMachine = createToolMachine<SelectToolContext, SelectToolEvent>({
  id: 'selectTool',
  
  context: {
    dragStart: null,
    dragOffset: { x: 0, y: 0 },
    selectionBox: null,
    initialPositions: new Map(),
  },
  
  states: {
    idle: {
      entry: 'resetCursor',
      on: {
        POINTER_DOWN: [
          {
            target: 'translating',
            cond: 'isPointOnSelectedShape',
            actions: 'startTranslating'
          },
          {
            target: 'selecting.single',
            cond: 'isPointOnShape',
            actions: 'selectShape'
          },
          {
            target: 'selecting.brush',
            actions: 'startBrushSelection'
          }
        ],
        
        DOUBLE_CLICK: {
          target: 'cropping',
          cond: 'isPointOnShape',
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
      
      // === Invoke Service for snapping ===
      invoke: {
        id: 'snappingService',
        src: 'snappingService',
        data: (context) => ({
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
                  cond: 'isPointOnCropHandle'
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
}, {
  // === Actions ===
  actions: {
    resetCursor: assign({
      cursor: 'default'
    }),
    
    setCursorMove: assign({
      cursor: 'move'
    }),
    
    startTranslating: assign((context, event) => ({
      dragStart: event.point,
      dragOffset: { x: 0, y: 0 }
    })),
    
    recordInitialPositions: assign((context) => {
      const positions = new Map<string, Point>();
      context.selectedIds.forEach(id => {
        const shape = getShape(id);
        if (shape) {
          positions.set(id, { x: shape.x, y: shape.y });
        }
      });
      return { initialPositions: positions };
    }),
    
    updateTranslation: assign((context, event) => {
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
    
    commitTranslation: (context) => {
      commitShapeChanges();
    },
    
    cancelTranslation: (context) => {
      // Restore original positions
      context.initialPositions.forEach((pos, id) => {
        updateShape(id, pos);
      });
    },
    
    startBrushSelection: assign((context, event) => ({
      selectionBox: {
        x: event.point.x,
        y: event.point.y,
        width: 0,
        height: 0
      }
    })),
    
    updateSelectionBox: assign((context, event) => {
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
  },
  
  // === Guards ===
  guards: {
    isPointOnShape: (context, event) => {
      return !!getShapeAtPoint(event.point);
    },
    
    isPointOnSelectedShape: (context, event) => {
      const shape = getShapeAtPoint(event.point);
      return shape ? context.selectedIds.has(shape.id) : false;
    },
    
    isPointOnCropHandle: (context, event) => {
      return !!getCropHandleAtPoint(event.point);
    }
  },
  
  // === Services ===
  services: {
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
});
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

// === Drawing Tool Machine ===
export const drawingToolMachine = createToolMachine<DrawingToolContext>({
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
            pressure: (_, event) => event.pressure
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
}, {
  actions: {
    startStroke: assign((context, event) => ({
      currentStroke: [event.point],
      cursor: 'crosshair'
    })),
    
    addPoint: assign((context, event) => ({
      currentStroke: [...context.currentStroke, event.point]
    })),
    
    addSmoothPoint: assign((context, event) => {
      // Apply smoothing algorithm
      const smoothed = smoothPath(
        [...context.currentStroke, event.point],
        0.5
      );
      return { currentStroke: smoothed };
    }),
    
    updateStraightLine: assign((context, event) => {
      if (context.currentStroke.length === 0) return {};
      
      // Keep only first and current point for straight line
      return {
        currentStroke: [
          context.currentStroke[0],
          event.point
        ]
      };
    }),
    
    finalizeStroke: (context) => {
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
  
  services: {
    smoothingService: fromCallback(({ sendBack }) => {
      const interval = setInterval(() => {
        sendBack({ type: 'SMOOTH_TICK' });
      }, 16); // 60fps
      
      return () => clearInterval(interval);
    })
  }
});
```

### 4. Tool Manager with XState

```typescript
import { createMachine, interpret, spawn, assign } from 'xstate';
import type { ActorRefFrom } from 'xstate';

// === Tool Registry Machine ===
interface ToolManagerContext {
  availableTools: Map<string, any>;
  currentToolId: string | null;
  currentToolActor: ActorRefFrom<any> | null;
  toolHistory: string[];
}

export const toolManagerMachine = createMachine({
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
}, {
  actions: {
    registerTool: assign((context, event) => {
      context.availableTools.set(event.id, event.machine);
      return context;
    }),
    
    activateTool: assign((context, event) => {
      const machine = context.availableTools.get(event.toolId);
      if (!machine) {
        console.error(`Tool ${event.toolId} not found`);
        return context;
      }
      
      // Stop current tool if exists
      if (context.currentToolActor) {
        context.currentToolActor.stop();
      }
      
      // Spawn new tool actor
      const actor = spawn(machine, { sync: true });
      
      return {
        ...context,
        currentToolId: event.toolId,
        currentToolActor: actor,
        toolHistory: [...context.toolHistory, event.toolId]
      };
    }),
    
    deactivateCurrentTool: assign((context) => {
      if (context.currentToolActor) {
        context.currentToolActor.stop();
      }
      
      return {
        ...context,
        currentToolActor: null
      };
    }),
    
    forwardToTool: (context, event) => {
      if (context.currentToolActor) {
        context.currentToolActor.send(event.payload);
      }
    }
  }
});

// === Tool Manager Service ===
export class ToolManager {
  private service: any;
  
  constructor() {
    this.service = interpret(toolManagerMachine)
      .onTransition((state) => {
        console.log('Tool Manager:', state.value);
      })
      .start();
    
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
    this.service.send({ type: 'REGISTER_TOOL', id, machine });
  }
  
  activate(toolId: string) {
    this.service.send({ type: 'ACTIVATE_TOOL', toolId });
  }
  
  send(event: any) {
    this.service.send({ type: 'FORWARD_EVENT', payload: event });
  }
  
  getCurrentTool() {
    return this.service.state.context.currentToolId;
  }
}
```

### 5. React Integration

```typescript
import { useMachine, useActor } from '@xstate/react';
import { useEffect, useRef, useCallback } from 'react';

// === XState React Hook ===
export function useToolMachine(toolId: string) {
  const [state, send] = useMachine(() => {
    switch (toolId) {
      case 'select':
        return selectToolMachine;
      case 'draw':
        return drawingToolMachine;
      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
  });
  
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

### 6. Advanced Patterns

```typescript
// === Spawning Child Machines ===
export const parentToolMachine = createMachine({
  id: 'parentTool',
  
  context: {
    childActors: new Map()
  },
  
  states: {
    active: {
      entry: assign((context) => {
        // Spawn multiple child machines
        const selectActor = spawn(selectToolMachine);
        const drawActor = spawn(drawingToolMachine);
        
        context.childActors.set('select', selectActor);
        context.childActors.set('draw', drawActor);
        
        return context;
      }),
      
      on: {
        DELEGATE_TO_CHILD: {
          actions: (context, event) => {
            const actor = context.childActors.get(event.childId);
            actor?.send(event.payload);
          }
        }
      }
    }
  }
});

// === Model-Based Testing ===
import { createModel } from '@xstate/test';

const testModel = createModel(selectToolMachine).withEvents({
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

// === Persistence & Hydration ===
export const persistentToolMachine = createMachine({
  id: 'persistentTool',
  
  context: {
    // Load from localStorage
    ...JSON.parse(localStorage.getItem('toolState') || '{}')
  },
  
  on: {
    '*': {
      actions: (context) => {
        // Save to localStorage on any event
        localStorage.setItem('toolState', JSON.stringify(context));
      }
    }
  }
});

// === Time Travel Debugging ===
export function useTimeTravel(machine: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [state, send] = useMachine(machine, {
    devTools: true
  });
  
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

### 7. TypeScript Integration

```typescript
// === Type Generation ===
// Run: npx xstate typegen "src/**/*.ts?(x)"

import type { StateFrom, EventFrom, ActorRefFrom } from 'xstate';

// Type-safe state
export type SelectToolState = StateFrom<typeof selectToolMachine>;
export type SelectToolEvent = EventFrom<typeof selectToolMachine>;
export type SelectToolActor = ActorRefFrom<typeof selectToolMachine>;

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

## 🎯 Key Benefits of XState

### 1. **Visualizable**
- XState Visualizer でステートマシンを可視化
- リアルタイムでの状態遷移の確認
- デバッグが容易

### 2. **Type-Safe**
- TypeScript完全対応
- 自動型生成
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

## 📊 Migration Plan

### Phase 1: Setup (Day 1)
```bash
npm install xstate @xstate/react @xstate/cli
npx xstate typegen "src/**/*.ts"
```

### Phase 2: Basic Tools (Day 2-3)
- SelectTool実装
- DrawingTool実装
- RectangleTool実装

### Phase 3: Advanced Features (Day 4-5)
- 階層状態の実装
- Actor Modelの活用
- Service統合

### Phase 4: Testing & Polish (Day 6-7)
- Model-based testing
- Performance optimization
- Documentation

## 🚀 Getting Started

```bash
# Install dependencies
pnpm add xstate @xstate/react

# Generate types
npx xstate typegen "src/**/*.ts"

# Start development with Inspector
XSTATE_INSPECT=true pnpm dev
```

## 📚 Resources

- [XState Documentation](https://xstate.js.org/docs/)
- [XState Visualizer](https://stately.ai/viz)
- [XState Catalogue](https://xstate-catalogue.com/)
- [Video Course](https://frontendmasters.com/courses/xstate-v2/)

---

*この設計により、宣言的で保守性の高いToolシステムが実現できます。*
*最終更新: 2025-01-14*