# Advanced StateMachine Design for uSketch

## 🎯 概要

tldrawの洗練されたアーキテクチャを参考に、**階層的StateNode**システムと**Reactive State管理**を組み合わせた、より高度なStateMachine設計を提案します。

## 🏗️ コアアーキテクチャ

### 1. StateNode基底クラス

```typescript
import { Atom, Computed, atom, computed } from '@usketch/state';

export abstract class StateNode<TContext = any> implements Partial<ToolEventHandlers> {
  // === Reactive State ===
  private _isActive: Atom<boolean>;
  private _current: Atom<StateNode | undefined>;
  private _path: Computed<string>;
  private _context: Atom<TContext>;
  
  // === Tree Structure ===
  readonly type: 'root' | 'branch' | 'leaf';
  readonly id: string;
  readonly parent?: StateNode;
  readonly children?: Record<string, StateNode>;
  
  // === Static Configuration ===
  static id: string;
  static initial?: string;
  static children?: () => StateNodeConstructor[];
  static isLockable?: boolean = false;
  static preserveOnExit?: boolean = false;
  
  // === Performance Tracking ===
  private performanceTracker?: PerformanceTracker;
  
  // === History Management ===
  protected markId: string = '';
  
  constructor(
    protected editor: WhiteboardEditor,
    parent?: StateNode
  ) {
    this.id = (this.constructor as StateNodeConstructor).id;
    this.parent = parent;
    this.type = this.determineType();
    
    // Initialize Reactive State
    this._isActive = atom('active:' + this.id, false);
    this._current = atom('current:' + this.id, undefined);
    this._context = atom('context:' + this.id, this.getInitialContext());
    this._path = computed('path:' + this.id, () => this.computePath());
    
    // Initialize children
    this.children = this.initializeChildren();
  }
  
  // === Abstract Methods ===
  protected abstract getInitialContext(): TContext;
  
  // === Lifecycle Hooks ===
  onEnter?(info?: any, from?: string): void;
  onExit?(info?: any, to?: string): void;
  onTransition?(from: string, to: string, info?: any): void;
  
  // === Event Handlers (Partial Implementation) ===
  onPointerDown?(info: PointerEventInfo): void;
  onPointerMove?(info: PointerEventInfo): void;
  onPointerUp?(info: PointerEventInfo): void;
  onKeyDown?(info: KeyboardEventInfo): void;
  onDoubleClick?(info: ClickEventInfo): void;
  onWheel?(info: WheelEventInfo): void;
  onCancel?(): void;
  onComplete?(): void;
  onInterrupt?(): void;
  
  // === Public API ===
  
  /**
   * 状態遷移を実行
   * @param path - ドット記法のパス (例: "select.crop.idle")
   * @param info - 遷移に伴う情報
   */
  transition(path: string, info: any = {}): this {
    const segments = path.split('.');
    let current: StateNode = this;
    
    for (const segment of segments) {
      const child = current.children?.[segment];
      if (!child) {
        throw new Error(`Invalid transition path: ${path}`);
      }
      
      current.transitionToChild(child, info);
      current = child;
    }
    
    return this;
  }
  
  /**
   * 現在アクティブな子状態を取得
   */
  getCurrent(): StateNode | undefined {
    return this._current.get();
  }
  
  /**
   * 現在の完全なパスを取得
   */
  getPath(): string {
    return this._path.get();
  }
  
  /**
   * コンテキストを取得/更新
   */
  getContext(): TContext {
    return this._context.get();
  }
  
  updateContext(updater: (ctx: TContext) => TContext): void {
    this._context.set(updater(this._context.get()));
  }
  
  // === Private Methods ===
  
  private transitionToChild(child: StateNode, info: any): void {
    const prevChild = this._current.get();
    
    if (prevChild === child) return;
    
    // Exit previous child
    if (prevChild) {
      this.onTransition?.(prevChild.id, child.id, info);
      prevChild.exit(info, child.id);
    }
    
    // Update current
    this._current.set(child);
    
    // Enter new child
    child.enter(info, prevChild?.id);
  }
  
  private enter(info: any, from?: string): void {
    if (this.performanceTracker) {
      this.performanceTracker.start(this.id);
    }
    
    this._isActive.set(true);
    this.onEnter?.(info, from);
    
    // Auto-transition to initial child
    const initial = this.getInitialChild();
    if (initial && this.type === 'branch') {
      this.transitionToChild(initial, info);
    }
  }
  
  private exit(info: any, to?: string): void {
    // Exit current child first
    const current = this._current.get();
    if (current) {
      current.exit(info, to);
    }
    
    this.onExit?.(info, to);
    this._isActive.set(false);
    
    if (!this.constructor.preserveOnExit) {
      this._current.set(undefined);
      this._context.set(this.getInitialContext());
    }
    
    if (this.performanceTracker) {
      this.performanceTracker.stop();
    }
  }
  
  // === Event Handling ===
  
  handleEvent(info: ToolEventInfo): void {
    // Map event to handler method
    const handlerName = this.getHandlerName(info.name);
    const handler = this[handlerName as keyof this] as Function | undefined;
    
    // Call own handler
    if (handler && typeof handler === 'function') {
      handler.call(this, info);
    }
    
    // Propagate to active child
    const current = this._current.get();
    if (current && this._isActive.get()) {
      current.handleEvent(info);
    }
  }
}
```

### 2. 階層的状態の設計

```typescript
// === Root Tool ===
export class SelectTool extends StateNode {
  static override id = 'select';
  static override initial = 'idle';
  
  static override children() {
    return [
      IdleState,
      PointingCanvas,
      PointingShape,
      Brushing,
      Translating,
      Rotating,
      Scaling,
      CropMode,  // Branch state with sub-states
    ];
  }
  
  protected getInitialContext() {
    return {
      selectedIds: new Set<string>(),
      selectionBounds: null as Bounds | null,
      dragStart: null as Point | null,
    };
  }
}

// === Branch State (has children) ===
export class CropMode extends StateNode {
  static override id = 'crop';
  static override initial = 'idle';
  
  static override children() {
    return [
      CropIdle,
      CropTranslating,
      CropPointingHandle,
      Cropping,
    ];
  }
  
  protected getInitialContext() {
    return {
      cropBounds: null as Bounds | null,
      targetShape: null as Shape | null,
    };
  }
  
  override onEnter(info: { shapeId: string }) {
    // 履歴ポイントを作成
    this.markId = this.editor.markHistoryStoppingPoint('crop');
    
    // ターゲットシェイプを設定
    const shape = this.editor.getShape(info.shapeId);
    this.updateContext(ctx => ({ ...ctx, targetShape: shape }));
  }
  
  override onExit() {
    // 履歴を統合
    this.editor.squashToMark(this.markId);
  }
  
  override onCancel() {
    // 履歴をロールバック
    this.editor.bailToMark(this.markId);
    this.parent?.transition('idle');
  }
}

// === Leaf State (no children) ===
export class Translating extends StateNode {
  static override id = 'translating';
  
  private dragStart: Point | null = null;
  private initialPositions = new Map<string, Point>();
  
  protected getInitialContext() {
    return {
      isDragging: false,
      dragOffset: { x: 0, y: 0 },
    };
  }
  
  override onEnter(info: { point: Point }) {
    this.dragStart = info.point;
    
    // 選択中のシェイプの初期位置を記録
    const selectedShapes = this.editor.getSelectedShapes();
    selectedShapes.forEach(shape => {
      this.initialPositions.set(shape.id, { x: shape.x, y: shape.y });
    });
    
    this.updateContext(ctx => ({ ...ctx, isDragging: true }));
  }
  
  override onPointerMove(info: PointerEventInfo) {
    if (!this.dragStart) return;
    
    const delta = {
      x: info.point.x - this.dragStart.x,
      y: info.point.y - this.dragStart.y,
    };
    
    // Snap to grid if enabled
    const snappedDelta = this.editor.snapToGrid(delta);
    
    // Update shapes
    this.initialPositions.forEach((initialPos, shapeId) => {
      this.editor.updateShape(shapeId, {
        x: initialPos.x + snappedDelta.x,
        y: initialPos.y + snappedDelta.y,
      });
    });
    
    this.updateContext(ctx => ({ ...ctx, dragOffset: snappedDelta }));
  }
  
  override onPointerUp() {
    this.complete();
  }
  
  override onKeyDown(info: KeyboardEventInfo) {
    if (info.key === 'Escape') {
      this.cancel();
    }
  }
  
  private complete() {
    this.editor.commitTransaction();
    this.parent?.transition('idle');
  }
  
  private cancel() {
    // 初期位置に戻す
    this.initialPositions.forEach((pos, shapeId) => {
      this.editor.updateShape(shapeId, pos);
    });
    
    this.parent?.transition('idle');
  }
}
```

### 3. イベントシステム

```typescript
// === Event Types ===
export interface ToolEventInfo {
  name: ToolEventName;
  timestamp: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

export interface PointerEventInfo extends ToolEventInfo {
  name: 'pointer_down' | 'pointer_move' | 'pointer_up';
  point: Point;          // World coordinates
  screenPoint: Point;    // Screen coordinates
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
  isPen?: boolean;
}

export interface KeyboardEventInfo extends ToolEventInfo {
  name: 'key_down' | 'key_up' | 'key_repeat';
  key: string;
  code: string;
}

export interface WheelEventInfo extends ToolEventInfo {
  name: 'wheel';
  delta: Point;
  point: Point;
}

// === Event Manager ===
export class ToolEventManager {
  private currentTool: StateNode | null = null;
  private eventQueue: ToolEventInfo[] = [];
  private isProcessing = false;
  
  setCurrentTool(tool: StateNode) {
    this.currentTool = tool;
  }
  
  /**
   * イベントをディスパッチ
   */
  dispatch(event: ToolEventInfo) {
    // Coalesced eventsの処理
    if (this.shouldCoalesce(event)) {
      this.coalesceEvent(event);
      return;
    }
    
    this.eventQueue.push(event);
    this.processQueue();
  }
  
  private processQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      
      try {
        this.currentTool?.handleEvent(event);
      } catch (error) {
        console.error('Error handling event:', error);
        this.currentTool?.onInterrupt?.();
      }
    }
    
    this.isProcessing = false;
  }
  
  private shouldCoalesce(event: ToolEventInfo): boolean {
    // pointer_moveイベントは結合する
    return event.name === 'pointer_move' && 
           this.currentTool?.constructor.useCoalescedEvents;
  }
  
  private coalesceEvent(event: ToolEventInfo) {
    const lastEvent = this.eventQueue[this.eventQueue.length - 1];
    if (lastEvent?.name === event.name) {
      // 最後のイベントを置き換え
      this.eventQueue[this.eventQueue.length - 1] = event;
    } else {
      this.eventQueue.push(event);
    }
  }
}
```

### 4. カスタムTool作成API

```typescript
// === シンプルなカスタムTool ===
export class CustomPenTool extends StateNode {
  static override id = 'custom-pen';
  static override initial = 'idle';
  
  static override children() {
    return [PenIdle, PenDrawing];
  }
  
  protected getInitialContext() {
    return {
      currentStroke: null as Stroke | null,
      strokeStyle: {
        color: '#000000',
        width: 2,
        opacity: 1,
      },
    };
  }
}

// === 高度なカスタムTool（ベースクラス利用） ===
export abstract class BaseShapeTool extends StateNode {
  static override initial = 'idle';
  
  static override children() {
    return [ShapeIdle, ShapeCreating];
  }
  
  abstract shapeType: string;
  abstract createShape(bounds: Bounds): Shape;
  
  protected getInitialContext() {
    return {
      preview: null as Shape | null,
      isCreating: false,
    };
  }
  
  onCreate?(shape: Shape): void;
}

// 具象実装
export class RectangleTool extends BaseShapeTool {
  static override id = 'rectangle';
  
  override shapeType = 'rectangle';
  
  override createShape(bounds: Bounds): Shape {
    return {
      type: 'rectangle',
      ...bounds,
      fill: this.editor.getCurrentStyle().fill,
      stroke: this.editor.getCurrentStyle().stroke,
    };
  }
  
  override onCreate(shape: Shape) {
    // カスタムロジック
    console.log('Rectangle created:', shape);
  }
}
```

### 5. Tool合成パターン

```typescript
// === Mixin Pattern ===
export function withSnapping<T extends StateNodeConstructor>(Base: T) {
  return class extends Base {
    snapThreshold = 10;
    
    snapPoint(point: Point): Point {
      const grid = this.editor.getGridSize();
      return {
        x: Math.round(point.x / grid) * grid,
        y: Math.round(point.y / grid) * grid,
      };
    }
    
    override onPointerMove(info: PointerEventInfo) {
      const snappedInfo = {
        ...info,
        point: this.snapPoint(info.point),
      };
      super.onPointerMove?.(snappedInfo);
    }
  };
}

export function withGuidelines<T extends StateNodeConstructor>(Base: T) {
  return class extends Base {
    guidelines: Line[] = [];
    
    override onEnter(info: any, from?: string) {
      super.onEnter?.(info, from);
      this.showGuidelines();
    }
    
    override onExit(info: any, to?: string) {
      this.hideGuidelines();
      super.onExit?.(info, to);
    }
    
    private showGuidelines() {
      this.guidelines = this.editor.calculateGuidelines();
      this.editor.renderGuidelines(this.guidelines);
    }
    
    private hideGuidelines() {
      this.editor.clearGuidelines();
      this.guidelines = [];
    }
  };
}

// 使用例
export class SmartRectangleTool extends withGuidelines(withSnapping(RectangleTool)) {
  static override id = 'smart-rectangle';
}
```

### 6. デバッグとパフォーマンス

```typescript
// === Performance Tracking ===
export class PerformanceTracker {
  private startTime: number = 0;
  private measurements = new Map<string, number[]>();
  
  start(id: string) {
    this.startTime = performance.now();
  }
  
  stop(id: string) {
    const duration = performance.now() - this.startTime;
    const measurements = this.measurements.get(id) || [];
    measurements.push(duration);
    this.measurements.set(id, measurements);
    
    if (duration > 16) {  // 60fps threshold
      console.warn(`Slow state: ${id} took ${duration}ms`);
    }
  }
  
  getStats(id: string) {
    const measurements = this.measurements.get(id) || [];
    if (measurements.length === 0) return null;
    
    return {
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      count: measurements.length,
    };
  }
}

// === Debug Visualizer ===
export class StateDebugger {
  private stateHistory: Array<{
    timestamp: number;
    path: string;
    event: string;
    context: any;
  }> = [];
  
  logTransition(from: string, to: string, info: any) {
    this.stateHistory.push({
      timestamp: Date.now(),
      path: `${from} → ${to}`,
      event: info.trigger || 'manual',
      context: info,
    });
    
    if (debugFlags.logTransitions.get()) {
      console.log(
        `%c[State] ${from} → ${to}`,
        'color: #4CAF50; font-weight: bold',
        info
      );
    }
  }
  
  visualize() {
    // Mermaid diagram generation
    const diagram = this.generateMermaidDiagram();
    console.log('State Diagram:', diagram);
  }
  
  private generateMermaidDiagram(): string {
    // Generate state diagram from history
    return `
      stateDiagram-v2
        [*] --> Idle
        Idle --> Drawing: pointer_down
        Drawing --> Idle: pointer_up
        Drawing --> Drawing: pointer_move
    `;
  }
}
```

### 7. テスト用ユーティリティ

```typescript
// === Test Harness ===
export class StateNodeTestHarness {
  private node: StateNode;
  private mockEditor: MockEditor;
  private eventLog: ToolEventInfo[] = [];
  
  constructor(NodeClass: StateNodeConstructor) {
    this.mockEditor = new MockEditor();
    this.node = new NodeClass(this.mockEditor);
  }
  
  async dispatchEvent(event: Partial<ToolEventInfo>) {
    const fullEvent: ToolEventInfo = {
      name: 'pointer_down',
      timestamp: Date.now(),
      ...event,
    };
    
    this.eventLog.push(fullEvent);
    this.node.handleEvent(fullEvent);
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  expectState(path: string) {
    expect(this.node.getPath()).toBe(path);
  }
  
  expectContext(matcher: any) {
    expect(this.node.getContext()).toMatchObject(matcher);
  }
  
  getEventLog() {
    return this.eventLog;
  }
}

// === Usage in Tests ===
describe('SelectTool', () => {
  let harness: StateNodeTestHarness;
  
  beforeEach(() => {
    harness = new StateNodeTestHarness(SelectTool);
  });
  
  it('should transition to brushing on drag', async () => {
    await harness.dispatchEvent({
      name: 'pointer_down',
      point: { x: 0, y: 0 },
    });
    
    await harness.dispatchEvent({
      name: 'pointer_move',
      point: { x: 100, y: 100 },
    });
    
    harness.expectState('select.brushing');
    harness.expectContext({
      selectionBounds: { x: 0, y: 0, width: 100, height: 100 },
    });
  });
});
```

## 🎯 主な改善点

### 1. **階層的状態管理**
- Root → Branch → Leaf の3層構造
- ドット記法による深い遷移（`select.crop.idle`）
- 親子間の明確な責任分離

### 2. **Reactive State**
- Atom/Computedによる効率的な状態管理
- 自動的な依存関係追跡
- 最小限の再レンダリング

### 3. **型安全性の向上**
- ジェネリクスを活用したコンテキスト型
- 静的プロパティによる設定
- イベント型の厳密な定義

### 4. **拡張性**
- Mixinパターンによる機能合成
- ベースクラスの継承
- プラグイン可能なアーキテクチャ

### 5. **デバッグ性**
- パフォーマンス追跡
- 状態遷移のビジュアライズ
- 包括的なテストハーネス

### 6. **履歴管理**
- 状態遷移と連動したUndo/Redo
- マークポイントシステム
- トランザクション管理

## 📊 パフォーマンス最適化

```typescript
// === Coalesced Events ===
export class OptimizedDrawingTool extends StateNode {
  static override useCoalescedEvents = true;  // pointer_moveを結合
  
  private pointBuffer: Point[] = [];
  private lastProcessTime = 0;
  
  override onPointerMove(info: PointerEventInfo) {
    this.pointBuffer.push(info.point);
    
    const now = performance.now();
    if (now - this.lastProcessTime > 16) {  // 60fps
      this.processPoints();
      this.lastProcessTime = now;
    }
  }
  
  private processPoints() {
    // Douglas-Peucker algorithm for point reduction
    const simplified = simplifyPath(this.pointBuffer, 1.0);
    this.renderPath(simplified);
    this.pointBuffer = [];
  }
}
```

## 🚀 移行戦略

1. **Phase 1**: StateNode基底クラス実装（1週間）
2. **Phase 2**: イベントシステム構築（3日）
3. **Phase 3**: 既存Tool移行（1週間）
4. **Phase 4**: テストとドキュメント（3日）

これにより、tldrawレベルの洗練されたTool システムを実現できます。

---

*最終更新: 2025-01-14*
*参考: tldraw v2.0 architecture*