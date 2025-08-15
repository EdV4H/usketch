# Undo/Redoシステム仕様書

DOMホワイトボードライブラリのUndo/Redoシステムの詳細な仕様とコマンドパターンによる実装について説明します。

## 🎯 概要

Undo/Redoシステムはコマンドパターンを採用し、全ての操作をコマンドオブジェクトとして管理します。これにより、操作の取り消し・やり直しが可能になり、複雑な操作の組み合わせにも対応できます。

## 🏗️ アーキテクチャ

### コマンドパターンの実装

```typescript
// 基底コマンドインターフェース
interface Command {
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  execute(): void;
  undo(): void;
  redo?(): void; // デフォルトはexecute()を呼び出し
  
  // コマンドの統合可能性をチェック
  canMergeWith?(other: Command): boolean;
  mergeWith?(other: Command): Command;
}

// 抽象コマンドクラス
abstract class BaseCommand implements Command {
  readonly id: string;
  readonly timestamp: number;
  
  constructor(
    public readonly description: string,
    protected readonly engine: WhiteboardEngine
  ) {
    this.id = generateId();
    this.timestamp = Date.now();
  }
  
  abstract execute(): void;
  abstract undo(): void;
  
  redo(): void {
    this.execute();
  }
  
  canMergeWith(other: Command): boolean {
    return false; // デフォルトはマージ不可
  }
  
  mergeWith(other: Command): Command {
    throw new Error('Merge not supported');
  }
}
```

### 履歴管理システム

```typescript
class HistoryManager {
  private commands: Command[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 100;
  private mergeTimeWindow: number = 500; // ms
  
  constructor(private engine: WhiteboardEngine) {
    this.setupKeyboardShortcuts();
  }
  
  // コマンドの実行と履歴への追加
  executeCommand(command: Command): void {
    // 実行前のバリデーション
    if (!this.validateCommand(command)) {
      throw new Error(`Invalid command: ${command.description}`);
    }
    
    try {
      // コマンド実行
      command.execute();
      
      // 履歴に追加
      this.addToHistory(command);
      
      // イベント発火
      this.engine.emit('command:executed', { command });
      
    } catch (error) {
      console.error('Command execution failed:', error);
      this.engine.emit('command:failed', { command, error });
      throw error;
    }
  }
  
  private addToHistory(command: Command): void {
    // 現在位置より後の履歴を削除（分岐した履歴）
    this.commands = this.commands.slice(0, this.currentIndex + 1);
    
    // コマンドのマージを試行
    const merged = this.tryMergeCommand(command);
    if (merged) {
      // マージ成功：最後のコマンドを置換
      this.commands[this.commands.length - 1] = merged;
    } else {
      // マージ失敗：新しいコマンドを追加
      this.commands.push(command);
      this.currentIndex++;
    }
    
    // 履歴サイズ制限
    this.trimHistory();
  }
  
  private tryMergeCommand(command: Command): Command | null {
    if (this.commands.length === 0) return null;
    
    const lastCommand = this.commands[this.commands.length - 1];
    const timeDiff = command.timestamp - lastCommand.timestamp;
    
    // 時間窓内でマージ可能な場合
    if (timeDiff <= this.mergeTimeWindow && 
        lastCommand.canMergeWith(command)) {
      return lastCommand.mergeWith(command);
    }
    
    return null;
  }
  
  private trimHistory(): void {
    if (this.commands.length > this.maxHistorySize) {
      const excess = this.commands.length - this.maxHistorySize;
      this.commands = this.commands.slice(excess);
      this.currentIndex -= excess;
    }
  }
  
  // Undo操作
  undo(): boolean {
    if (!this.canUndo()) return false;
    
    const command = this.commands[this.currentIndex];
    
    try {
      command.undo();
      this.currentIndex--;
      
      this.engine.emit('command:undone', { command });
      return true;
      
    } catch (error) {
      console.error('Undo failed:', error);
      this.engine.emit('command:undo-failed', { command, error });
      return false;
    }
  }
  
  // Redo操作
  redo(): boolean {
    if (!this.canRedo()) return false;
    
    const command = this.commands[this.currentIndex + 1];
    
    try {
      command.redo();
      this.currentIndex++;
      
      this.engine.emit('command:redone', { command });
      return true;
      
    } catch (error) {
      console.error('Redo failed:', error);
      this.engine.emit('command:redo-failed', { command, error });
      return false;
    }
  }
  
  // 状態確認
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }
  
  canRedo(): boolean {
    return this.currentIndex < this.commands.length - 1;
  }
  
  // 履歴の取得
  getHistory(): HistoryState {
    return {
      commands: this.commands.map(cmd => ({
        id: cmd.id,
        description: cmd.description,
        timestamp: cmd.timestamp,
      })),
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
  
  // 履歴のクリア
  clear(): void {
    this.commands = [];
    this.currentIndex = -1;
    this.engine.emit('history:cleared');
  }
  
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          this.redo();
        }
      }
    });
  }
}

interface HistoryState {
  commands: Array<{
    id: string;
    description: string;
    timestamp: number;
  }>;
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}
```

## 🎨 Shape操作コマンド

### CreateShapeCommand

```typescript
class CreateShapeCommand extends BaseCommand {
  private createdShape: Shape | null = null;
  
  constructor(
    private readonly shapeOptions: CreateShapeOptions,
    engine: WhiteboardEngine
  ) {
    super(`図形作成: ${shapeOptions.type}`, engine);
  }
  
  execute(): void {
    this.createdShape = this.engine.addShape(this.shapeOptions);
    this.engine.selectShape(this.createdShape.id);
  }
  
  undo(): void {
    if (this.createdShape) {
      this.engine.removeShape(this.createdShape.id);
      this.createdShape = null;
    }
  }
  
  redo(): void {
    if (this.createdShape) {
      // 既存のShapeを再追加
      this.engine.restoreShape(this.createdShape);
    } else {
      // 初回実行
      this.execute();
    }
  }
}
```

### UpdateShapeCommand

```typescript
class UpdateShapeCommand extends BaseCommand {
  private originalState: Partial<Shape>;
  
  constructor(
    private readonly shapeId: string,
    private readonly updates: Partial<Shape>,
    engine: WhiteboardEngine
  ) {
    super(`図形更新: ${shapeId}`, engine);
    
    // 元の状態を保存
    const shape = engine.getShape(shapeId);
    if (!shape) {
      throw new Error(`Shape not found: ${shapeId}`);
    }
    
    this.originalState = this.extractUpdatedFields(shape, updates);
  }
  
  execute(): void {
    this.engine.updateShape(this.shapeId, this.updates);
  }
  
  undo(): void {
    this.engine.updateShape(this.shapeId, this.originalState);
  }
  
  // マージ可能性のチェック
  canMergeWith(other: Command): boolean {
    if (!(other instanceof UpdateShapeCommand)) return false;
    if (other.shapeId !== this.shapeId) return false;
    
    // 同じShapeの連続する更新はマージ可能
    return true;
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof UpdateShapeCommand)) {
      throw new Error('Cannot merge with non-UpdateShapeCommand');
    }
    
    // 新しい更新内容をマージ
    const mergedUpdates = { ...this.updates, ...other.updates };
    
    return new UpdateShapeCommand(
      this.shapeId,
      mergedUpdates,
      this.engine
    );
  }
  
  private extractUpdatedFields(shape: Shape, updates: Partial<Shape>): Partial<Shape> {
    const result: Partial<Shape> = {};
    
    Object.keys(updates).forEach(key => {
      if (key in shape) {
        result[key as keyof Shape] = shape[key as keyof Shape];
      }
    });
    
    return result;
  }
}
```

### DeleteShapeCommand

```typescript
class DeleteShapeCommand extends BaseCommand {
  private deletedShapes: Shape[] = [];
  
  constructor(
    private readonly shapeIds: string[],
    engine: WhiteboardEngine
  ) {
    super(`図形削除: ${shapeIds.length}個`, engine);
  }
  
  execute(): void {
    this.deletedShapes = this.shapeIds.map(id => {
      const shape = this.engine.getShape(id);
      if (!shape) {
        throw new Error(`Shape not found: ${id}`);
      }
      return shape;
    });
    
    // 削除実行
    this.shapeIds.forEach(id => {
      this.engine.removeShape(id);
    });
  }
  
  undo(): void {
    // 削除したShapeを復元
    this.deletedShapes.forEach(shape => {
      this.engine.restoreShape(shape);
    });
  }
  
  redo(): void {
    this.shapeIds.forEach(id => {
      this.engine.removeShape(id);
    });
  }
}
```

## 🔄 複合コマンド

### CompositeCommand

```typescript
class CompositeCommand extends BaseCommand {
  constructor(
    private readonly commands: Command[],
    description: string,
    engine: WhiteboardEngine
  ) {
    super(description, engine);
  }
  
  execute(): void {
    this.commands.forEach(command => {
      command.execute();
    });
  }
  
  undo(): void {
    // 逆順で元に戻す
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
  
  redo(): void {
    this.commands.forEach(command => {
      command.redo();
    });
  }
}
```

### MoveShapeCommand (移動専用)

```typescript
class MoveShapeCommand extends BaseCommand {
  private originalPositions: Map<string, Point> = new Map();
  
  constructor(
    private readonly shapeIds: string[],
    private readonly deltaX: number,
    private readonly deltaY: number,
    engine: WhiteboardEngine
  ) {
    super(`図形移動: ${shapeIds.length}個`, engine);
    
    // 元の位置を記録
    shapeIds.forEach(id => {
      const shape = engine.getShape(id);
      if (shape) {
        this.originalPositions.set(id, { x: shape.x, y: shape.y });
      }
    });
  }
  
  execute(): void {
    this.shapeIds.forEach(id => {
      this.engine.updateShape(id, {
        x: this.engine.getShape(id)!.x + this.deltaX,
        y: this.engine.getShape(id)!.y + this.deltaY,
      });
    });
  }
  
  undo(): void {
    this.shapeIds.forEach(id => {
      const originalPos = this.originalPositions.get(id);
      if (originalPos) {
        this.engine.updateShape(id, originalPos);
      }
    });
  }
  
  // 移動コマンドのマージ
  canMergeWith(other: Command): boolean {
    if (!(other instanceof MoveShapeCommand)) return false;
    
    // 同じShapeセットの連続移動はマージ可能
    return this.hasSameShapeSet(other);
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof MoveShapeCommand)) {
      throw new Error('Cannot merge with non-MoveShapeCommand');
    }
    
    // 移動量を累積
    return new MoveShapeCommand(
      this.shapeIds,
      this.deltaX + other.deltaX,
      this.deltaY + other.deltaY,
      this.engine
    );
  }
  
  private hasSameShapeSet(other: MoveShapeCommand): boolean {
    if (this.shapeIds.length !== other.shapeIds.length) return false;
    
    const thisSet = new Set(this.shapeIds);
    return other.shapeIds.every(id => thisSet.has(id));
  }
}
```

## 🎛️ カメラ操作コマンド

### SetCameraCommand

```typescript
class SetCameraCommand extends BaseCommand {
  private originalCamera: Camera;
  
  constructor(
    private readonly newCamera: Partial<Camera>,
    engine: WhiteboardEngine
  ) {
    super('カメラ変更', engine);
    this.originalCamera = { ...engine.getCamera() };
  }
  
  execute(): void {
    this.engine.setCamera(this.newCamera);
  }
  
  undo(): void {
    this.engine.setCamera(this.originalCamera);
  }
  
  // カメラ操作のマージ
  canMergeWith(other: Command): boolean {
    return other instanceof SetCameraCommand;
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof SetCameraCommand)) {
      throw new Error('Cannot merge with non-SetCameraCommand');
    }
    
    // 最終的なカメラ状態のみを保持
    return new SetCameraCommand(
      { ...this.newCamera, ...other.newCamera },
      this.engine
    );
  }
}
```

## 🔧 高度な機能

### バッチコマンド処理

```typescript
class BatchCommandProcessor {
  private isProcessing = false;
  private batchCommands: Command[] = [];
  
  constructor(private historyManager: HistoryManager) {}
  
  startBatch(): void {
    this.isProcessing = true;
    this.batchCommands = [];
  }
  
  addCommand(command: Command): void {
    if (this.isProcessing) {
      this.batchCommands.push(command);
    } else {
      this.historyManager.executeCommand(command);
    }
  }
  
  commitBatch(description?: string): void {
    if (!this.isProcessing || this.batchCommands.length === 0) return;
    
    const compositeCommand = new CompositeCommand(
      this.batchCommands,
      description || `バッチ操作: ${this.batchCommands.length}個`,
      this.historyManager['engine']
    );
    
    this.historyManager.executeCommand(compositeCommand);
    this.endBatch();
  }
  
  cancelBatch(): void {
    this.endBatch();
  }
  
  private endBatch(): void {
    this.isProcessing = false;
    this.batchCommands = [];
  }
}
```

### コマンドマクロ機能

```typescript
class CommandMacro {
  private commands: Command[] = [];
  
  constructor(
    private readonly name: string,
    private readonly description: string
  ) {}
  
  record(command: Command): void {
    this.commands.push(command);
  }
  
  playback(engine: WhiteboardEngine): CompositeCommand {
    // コマンドを複製して新しいコンテキストで実行
    const clonedCommands = this.commands.map(cmd => this.cloneCommand(cmd, engine));
    
    return new CompositeCommand(
      clonedCommands,
      `マクロ実行: ${this.name}`,
      engine
    );
  }
  
  private cloneCommand(command: Command, engine: WhiteboardEngine): Command {
    // コマンドの種類に応じてクローンを作成
    // 実装は各コマンドクラスにclone()メソッドを追加して対応
    if ('clone' in command && typeof command.clone === 'function') {
      return (command as any).clone(engine);
    }
    
    throw new Error(`Command ${command.constructor.name} does not support cloning`);
  }
}
```

### スナップショット機能

```typescript
class SnapshotManager {
  private snapshots: Map<string, WhiteboardSnapshot> = new Map();
  
  constructor(private engine: WhiteboardEngine) {}
  
  createSnapshot(name: string): void {
    const snapshot: WhiteboardSnapshot = {
      name,
      timestamp: Date.now(),
      state: this.engine.exportState(),
      camera: { ...this.engine.getCamera() },
      selection: [...this.engine.getSelectedShapeIds()],
    };
    
    this.snapshots.set(name, snapshot);
  }
  
  restoreSnapshot(name: string): Command {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${name}`);
    }
    
    return new RestoreSnapshotCommand(snapshot, this.engine);
  }
  
  listSnapshots(): WhiteboardSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

interface WhiteboardSnapshot {
  name: string;
  timestamp: number;
  state: WhiteboardState;
  camera: Camera;
  selection: string[];
}

class RestoreSnapshotCommand extends BaseCommand {
  private previousState: WhiteboardSnapshot;
  
  constructor(
    private readonly snapshot: WhiteboardSnapshot,
    engine: WhiteboardEngine
  ) {
    super(`スナップショット復元: ${snapshot.name}`, engine);
    
    // 現在の状態を保存
    this.previousState = {
      name: 'previous',
      timestamp: Date.now(),
      state: engine.exportState(),
      camera: { ...engine.getCamera() },
      selection: [...engine.getSelectedShapeIds()],
    };
  }
  
  execute(): void {
    this.engine.loadState(this.snapshot.state);
    this.engine.setCamera(this.snapshot.camera);
    this.engine.setSelectedShapes(this.snapshot.selection);
  }
  
  undo(): void {
    this.engine.loadState(this.previousState.state);
    this.engine.setCamera(this.previousState.camera);
    this.engine.setSelectedShapes(this.previousState.selection);
  }
}
```

## 🔍 デバッグとモニタリング

### コマンド実行の監視

```typescript
class CommandMonitor {
  private executionTimes: Map<string, number[]> = new Map();
  private failedCommands: Command[] = [];
  
  constructor(private historyManager: HistoryManager) {
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    this.historyManager.on('command:executed', (event) => {
      this.recordExecution(event.command);
    });
    
    this.historyManager.on('command:failed', (event) => {
      this.recordFailure(event.command);
    });
  }
  
  private recordExecution(command: Command): void {
    const type = command.constructor.name;
    const times = this.executionTimes.get(type) || [];
    times.push(Date.now() - command.timestamp);
    this.executionTimes.set(type, times);
  }
  
  private recordFailure(command: Command): void {
    this.failedCommands.push(command);
  }
  
  getStatistics(): CommandStatistics {
    const stats: CommandStatistics = {
      executionTimes: {},
      totalCommands: 0,
      failedCommands: this.failedCommands.length,
      averageExecutionTime: 0,
    };
    
    let totalTime = 0;
    let totalCount = 0;
    
    this.executionTimes.forEach((times, type) => {
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      stats.executionTimes[type] = {
        count: times.length,
        averageTime: average,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
      };
      
      totalTime += times.reduce((a, b) => a + b, 0);
      totalCount += times.length;
    });
    
    stats.totalCommands = totalCount;
    stats.averageExecutionTime = totalCount > 0 ? totalTime / totalCount : 0;
    
    return stats;
  }
}

interface CommandStatistics {
  executionTimes: Record<string, {
    count: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
  }>;
  totalCommands: number;
  failedCommands: number;
  averageExecutionTime: number;
}
```

## 🎯 使用例

### 基本的な使用方法

```typescript
import { WhiteboardEngine, HistoryManager } from 'dom-wb-handson';

// エンジンとヒストリーマネージャーの初期化
const engine = new WhiteboardEngine({
  container: document.getElementById('canvas')!,
});

const historyManager = new HistoryManager(engine);

// Shape作成
const createCommand = new CreateShapeCommand({
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
}, engine);

historyManager.executeCommand(createCommand);

// Shape更新
const updateCommand = new UpdateShapeCommand(
  createdShape.id,
  { fill: '#ff0000' },
  engine
);

historyManager.executeCommand(updateCommand);

// Undo/Redo
document.getElementById('undo')?.addEventListener('click', () => {
  historyManager.undo();
});

document.getElementById('redo')?.addEventListener('click', () => {
  historyManager.redo();
});
```

### バッチ操作の例

```typescript
// 複数のShapeを一度に作成
const batchProcessor = new BatchCommandProcessor(historyManager);

batchProcessor.startBatch();

// 複数のコマンドを追加
for (let i = 0; i < 5; i++) {
  const command = new CreateShapeCommand({
    type: 'rectangle',
    x: i * 50,
    y: i * 50,
    width: 40,
    height: 40,
  }, engine);
  
  batchProcessor.addCommand(command);
}

batchProcessor.commitBatch('5つの長方形を作成');
```

---

📖 **関連ドキュメント**
- [描画ツールAPI](./drawing-tools.md) - 描画ツールの詳細仕様
- [アーキテクチャ設計](../architecture/) - システム全体の設計
- [API仕様書](./README.md) - 基本API仕様