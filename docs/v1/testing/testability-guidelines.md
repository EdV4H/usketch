# テスト可能性ガイドライン

## 🎯 目的

このガイドラインは、DOMホワイトボードプロジェクトにおいて、テスト可能な実装を行うための具体的な指針を提供します。

## 🏗️ アーキテクチャレベルのテスト可能性

### 1. 関心の分離（Separation of Concerns）

```typescript
// ❌ Bad: ビジネスロジックとDOM操作が混在
class Shape {
  constructor(private id: string) {}
  
  draw() {
    const element = document.createElement('div');
    element.id = this.id;
    element.style.width = '100px';
    element.style.height = '100px';
    
    // ビジネスロジックとDOM操作が密結合
    if (this.isSelected()) {
      element.style.border = '2px solid blue';
    }
    
    document.body.appendChild(element);
  }
}

// ✅ Good: ビジネスロジックとビューの分離
// Model
class ShapeModel {
  constructor(
    public id: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public selected: boolean = false
  ) {}
  
  move(deltaX: number, deltaY: number) {
    this.x += deltaX;
    this.y += deltaY;
  }
  
  select() {
    this.selected = true;
  }
}

// View
class ShapeView {
  private element: HTMLElement;
  
  constructor(private model: ShapeModel) {
    this.element = this.createElement();
    this.updateView();
  }
  
  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.setAttribute('data-shape-id', this.model.id);
    element.setAttribute('data-shape-type', 'rectangle');
    element.className = 'shape shape-rectangle';
    return element;
  }
  
  updateView() {
    // データ属性の更新
    this.element.setAttribute('data-shape-selected', String(this.model.selected));
    
    // スタイルの更新
    this.element.style.transform = `translate(${this.model.x}px, ${this.model.y}px)`;
    this.element.style.width = `${this.model.width}px`;
    this.element.style.height = `${this.model.height}px`;
    
    // CSSクラスの更新
    this.element.classList.toggle('selected', this.model.selected);
  }
  
  getElement(): HTMLElement {
    return this.element;
  }
}
```

### 2. 依存性注入（Dependency Injection）

```typescript
// ❌ Bad: 直接的な依存関係
class WhiteboardCanvas {
  private store = useWhiteboardStore(); // 直接インポート
  private renderer = new DOMRenderer(); // 直接インスタンス化
  
  constructor() {
    // テストで置換できない
  }
}

// ✅ Good: 依存性注入
interface Store {
  shapes: Shape[];
  selectedIds: string[];
  addShape(shape: Shape): void;
  updateShape(id: string, updates: Partial<Shape>): void;
}

interface Renderer {
  render(shapes: Shape[]): void;
  clear(): void;
}

class WhiteboardCanvas {
  constructor(
    private store: Store,
    private renderer: Renderer,
    private container: HTMLElement
  ) {
    this.initialize();
  }
  
  private initialize() {
    // テスト可能な初期化処理
    this.setupEventListeners();
    this.render();
  }
}

// テストでの使用
const mockStore = {
  shapes: [],
  selectedIds: [],
  addShape: vi.fn(),
  updateShape: vi.fn(),
};

const mockRenderer = {
  render: vi.fn(),
  clear: vi.fn(),
};

const canvas = new WhiteboardCanvas(mockStore, mockRenderer, container);
```

### 3. イベント駆動アーキテクチャ

```typescript
// イベントエミッターインターフェース
interface EventEmitter {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, data?: any): void;
}

// テスト可能なイベントシステム
class TestableEventEmitter implements EventEmitter {
  private events: Map<string, Set<Function>> = new Map();
  private eventLog: Array<{ event: string; data: any; timestamp: number }> = [];
  
  on(event: string, handler: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }
  
  off(event: string, handler: Function): void {
    this.events.get(event)?.delete(handler);
  }
  
  emit(event: string, data?: any): void {
    // イベントログに記録（テスト用）
    this.eventLog.push({ event, data, timestamp: Date.now() });
    
    // ハンドラーを実行
    this.events.get(event)?.forEach(handler => {
      handler(data);
    });
  }
  
  // テスト用メソッド
  getEventLog(): typeof this.eventLog {
    return [...this.eventLog];
  }
  
  clearEventLog(): void {
    this.eventLog = [];
  }
  
  hasEventHandler(event: string): boolean {
    return this.events.has(event) && this.events.get(event)!.size > 0;
  }
}
```

## 🧪 コンポーネントレベルのテスト可能性

### 1. 純粋関数の活用

```typescript
// ❌ Bad: 副作用のある関数
function updateShapePosition(shapeId: string, x: number, y: number) {
  const element = document.getElementById(shapeId);
  if (element) {
    element.style.left = x + 'px';
    element.style.top = y + 'px';
  }
  
  // グローバル状態を直接更新
  globalShapes[shapeId].x = x;
  globalShapes[shapeId].y = y;
}

// ✅ Good: 純粋関数
export function calculateNewPosition(
  currentPosition: Point,
  delta: Point,
  constraints?: BoundingBox
): Point {
  let newX = currentPosition.x + delta.x;
  let newY = currentPosition.y + delta.y;
  
  // 制約の適用
  if (constraints) {
    newX = Math.max(constraints.minX, Math.min(newX, constraints.maxX));
    newY = Math.max(constraints.minY, Math.min(newY, constraints.maxY));
  }
  
  return { x: newX, y: newY };
}

export function applyPositionToElement(
  element: HTMLElement,
  position: Point
): void {
  element.style.transform = `translate(${position.x}px, ${position.y}px)`;
}

// テスト
describe('calculateNewPosition', () => {
  it('should calculate position without constraints', () => {
    const result = calculateNewPosition(
      { x: 100, y: 100 },
      { x: 50, y: -20 }
    );
    expect(result).toEqual({ x: 150, y: 80 });
  });
  
  it('should apply constraints', () => {
    const result = calculateNewPosition(
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { minX: 0, minY: 0, maxX: 200, maxY: 200 }
    );
    expect(result).toEqual({ x: 200, y: 200 });
  });
});
```

### 2. DOM操作の抽象化

```typescript
// DOM操作を抽象化するインターフェース
interface DOMManipulator {
  createElement(tag: string, attributes?: Record<string, string>): HTMLElement;
  setAttribute(element: HTMLElement, name: string, value: string): void;
  removeAttribute(element: HTMLElement, name: string): void;
  appendChild(parent: HTMLElement, child: HTMLElement): void;
  removeChild(parent: HTMLElement, child: HTMLElement): void;
  addEventListener(element: HTMLElement, event: string, handler: EventListener): void;
  removeEventListener(element: HTMLElement, event: string, handler: EventListener): void;
}

// 本番用実装
class RealDOMManipulator implements DOMManipulator {
  createElement(tag: string, attributes?: Record<string, string>): HTMLElement {
    const element = document.createElement(tag);
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    return element;
  }
  
  setAttribute(element: HTMLElement, name: string, value: string): void {
    element.setAttribute(name, value);
  }
  
  // ... その他のメソッド
}

// テスト用実装
class MockDOMManipulator implements DOMManipulator {
  private operations: Array<{ method: string; args: any[] }> = [];
  
  createElement(tag: string, attributes?: Record<string, string>): HTMLElement {
    this.operations.push({ method: 'createElement', args: [tag, attributes] });
    const element = document.createElement(tag);
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    return element;
  }
  
  getOperations(): typeof this.operations {
    return [...this.operations];
  }
  
  // ... その他のメソッド
}
```

### 3. 時間依存の処理

```typescript
// ❌ Bad: 直接的な時間依存
class AnimationController {
  animate() {
    const startTime = Date.now();
    
    const frame = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        this.updateAnimation(elapsed / 1000);
        requestAnimationFrame(frame);
      }
    };
    
    requestAnimationFrame(frame);
  }
}

// ✅ Good: 時間の抽象化
interface TimeProvider {
  now(): number;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
}

class RealTimeProvider implements TimeProvider {
  now(): number {
    return Date.now();
  }
  
  requestAnimationFrame(callback: FrameRequestCallback): number {
    return window.requestAnimationFrame(callback);
  }
  
  cancelAnimationFrame(id: number): void {
    window.cancelAnimationFrame(id);
  }
}

class MockTimeProvider implements TimeProvider {
  private currentTime = 0;
  private frames: Array<{ id: number; callback: FrameRequestCallback }> = [];
  private nextFrameId = 1;
  
  now(): number {
    return this.currentTime;
  }
  
  requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this.nextFrameId++;
    this.frames.push({ id, callback });
    return id;
  }
  
  cancelAnimationFrame(id: number): void {
    this.frames = this.frames.filter(f => f.id !== id);
  }
  
  // テスト用メソッド
  advance(ms: number): void {
    this.currentTime += ms;
    const framesToRun = [...this.frames];
    this.frames = [];
    framesToRun.forEach(({ callback }) => callback(this.currentTime));
  }
}

class TestableAnimationController {
  constructor(private timeProvider: TimeProvider) {}
  
  animate(duration: number, updateFn: (progress: number) => void): void {
    const startTime = this.timeProvider.now();
    
    const frame = () => {
      const elapsed = this.timeProvider.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      updateFn(progress);
      
      if (progress < 1) {
        this.timeProvider.requestAnimationFrame(frame);
      }
    };
    
    this.timeProvider.requestAnimationFrame(frame);
  }
}
```

## 🔧 実装パターン

### 1. Factory Pattern

```typescript
// Shapeファクトリー
interface ShapeFactory {
  createShape(options: CreateShapeOptions): Shape;
}

class TestableShapeFactory implements ShapeFactory {
  private createdShapes: Shape[] = [];
  
  constructor(
    private idGenerator: () => string = () => `shape-${Date.now()}`
  ) {}
  
  createShape(options: CreateShapeOptions): Shape {
    const shape = new Shape({
      ...options,
      id: options.id || this.idGenerator(),
    });
    
    this.createdShapes.push(shape);
    return shape;
  }
  
  // テスト用メソッド
  getCreatedShapes(): Shape[] {
    return [...this.createdShapes];
  }
  
  reset(): void {
    this.createdShapes = [];
  }
}
```

### 2. Observer Pattern

```typescript
// 観察可能な状態管理
class ObservableState<T> {
  private state: T;
  private observers: Set<(state: T) => void> = new Set();
  private changeLog: Array<{ timestamp: number; changes: Partial<T> }> = [];
  
  constructor(initialState: T) {
    this.state = { ...initialState };
  }
  
  getState(): T {
    return { ...this.state };
  }
  
  setState(updates: Partial<T>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // 変更ログに記録
    this.changeLog.push({
      timestamp: Date.now(),
      changes: updates,
    });
    
    // オブザーバーに通知
    this.observers.forEach(observer => {
      observer(this.state);
    });
  }
  
  subscribe(observer: (state: T) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }
  
  // テスト用メソッド
  getChangeLog(): typeof this.changeLog {
    return [...this.changeLog];
  }
  
  getObserverCount(): number {
    return this.observers.size;
  }
}
```

### 3. Command Pattern

```typescript
// テスト可能なコマンドシステム
interface Command {
  id: string;
  execute(): void;
  undo(): void;
  canExecute(): boolean;
  
  // テスト用
  getDescription(): string;
}

class CommandManager {
  private history: Command[] = [];
  private currentIndex = -1;
  private listeners = new Set<(event: CommandEvent) => void>();
  
  execute(command: Command): void {
    if (!command.canExecute()) {
      this.notifyListeners({
        type: 'execution-failed',
        command,
        reason: 'Cannot execute command',
      });
      return;
    }
    
    try {
      command.execute();
      
      // 履歴の更新
      this.history = this.history.slice(0, this.currentIndex + 1);
      this.history.push(command);
      this.currentIndex++;
      
      this.notifyListeners({ type: 'executed', command });
    } catch (error) {
      this.notifyListeners({
        type: 'execution-error',
        command,
        error: error as Error,
      });
      throw error;
    }
  }
  
  undo(): boolean {
    if (this.currentIndex < 0) return false;
    
    const command = this.history[this.currentIndex];
    try {
      command.undo();
      this.currentIndex--;
      this.notifyListeners({ type: 'undone', command });
      return true;
    } catch (error) {
      this.notifyListeners({
        type: 'undo-error',
        command,
        error: error as Error,
      });
      return false;
    }
  }
  
  // テスト用メソッド
  getHistory(): Command[] {
    return [...this.history];
  }
  
  getCurrentIndex(): number {
    return this.currentIndex;
  }
  
  addListener(listener: (event: CommandEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(event: CommandEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}

type CommandEvent = 
  | { type: 'executed'; command: Command }
  | { type: 'undone'; command: Command }
  | { type: 'execution-failed'; command: Command; reason: string }
  | { type: 'execution-error'; command: Command; error: Error }
  | { type: 'undo-error'; command: Command; error: Error };
```

## 📊 テスト戦略

### 1. テストピラミッド

```
         /\
        /E2E\      ← 10% (ユーザーシナリオ)
       /------\
      /統合テスト\   ← 30% (コンポーネント連携)
     /----------\
    /ユニットテスト\  ← 60% (個別機能)
   /--------------\
```

### 2. テストの種類と目的

```typescript
// ユニットテスト: 純粋な関数とクラス
describe('Shape Model', () => {
  it('should calculate bounds correctly', () => {
    const shape = new ShapeModel('test', 100, 100, 200, 150);
    const bounds = shape.getBounds();
    
    expect(bounds).toEqual({
      left: 100,
      top: 100,
      right: 300,
      bottom: 250,
      width: 200,
      height: 150,
    });
  });
});

// 統合テスト: コンポーネント間の連携
describe('Shape Selection Integration', () => {
  it('should update view when model changes', () => {
    const model = new ShapeModel('test', 0, 0, 100, 100);
    const view = new ShapeView(model);
    const controller = new ShapeController(model, view);
    
    controller.select();
    
    expect(model.selected).toBe(true);
    expect(view.getElement().getAttribute('data-shape-selected')).toBe('true');
  });
});

// E2Eテスト: ユーザーシナリオ
test('user can draw and select shapes', async ({ page }) => {
  await page.goto('/');
  
  // ツール選択
  await page.click('[data-tool="rectangle"]');
  
  // 描画
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(200, 200);
  await page.mouse.up();
  
  // 選択確認
  await page.click('[data-tool="select"]');
  await page.click('[data-shape-type="rectangle"]');
  
  await expect(page.locator('[data-shape-selected="true"]')).toBeVisible();
});
```

## ✅ チェックリスト

### 実装前のチェック

- [ ] 関心の分離が適切に行われているか
- [ ] 依存性は注入可能か
- [ ] 純粋関数として実装可能か
- [ ] DOM操作は抽象化されているか
- [ ] 時間依存の処理は制御可能か

### 実装後のチェック

- [ ] ユニットテストが書けるか
- [ ] モックなしでテスト可能な部分があるか
- [ ] 状態の変更が追跡可能か
- [ ] エラーケースがテスト可能か
- [ ] パフォーマンステストが可能か

### コードレビューのポイント

- [ ] テストが実装の内部構造に依存していないか
- [ ] テストが読みやすく、意図が明確か
- [ ] テストの実行時間が適切か
- [ ] テストが独立して実行可能か
- [ ] テストカバレッジが適切か

これらのガイドラインに従うことで、保守性が高く、信頼性のあるテストを作成できます。