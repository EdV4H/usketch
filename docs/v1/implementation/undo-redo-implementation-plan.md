# Undo/Redo機能 実装計画書

## 1. エグゼクティブサマリー

本ドキュメントは、uSketchアプリケーションにおけるUndo/Redo機能の実装計画を定義します。既存のドキュメント（`docs/api/undo-redo.md`）で定義されている仕様を基に、段階的かつ実践的な実装アプローチを提示します。

### 主要目標
- ✅ コマンドパターンベースのUndo/Redo機能の実装
- ✅ Zustandストアとのシームレスな統合
- ✅ キーボードショートカット（Cmd+Z / Cmd+Shift+Z）のサポート
- ✅ 複合操作のサポート（バッチ、マージ）

## 2. 現状分析

### 2.1 既存の仕様
- **設計完了**：`docs/api/undo-redo.md`に包括的な仕様が存在
- **アーキテクチャ**：コマンドパターンベースの設計
- **機能範囲**：基本操作から高度な機能（マクロ、スナップショット）まで定義

### 2.2 実装状況
- **Zustandストア**：`undo()`と`redo()`メソッドは存在するが未実装
- **履歴管理**：操作レベルの履歴管理システムは存在しない
- **形状操作**：即座に状態を変更、履歴記録なし

### 2.3 技術的準備状況
```typescript
// 現在のZustandストアの構造
interface WhiteboardStore {
  // 状態
  shapes: Record<string, Shape>;
  selectedShapeIds: Set<string>;
  camera: Camera;
  
  // アクション（履歴記録なし）
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  removeShape: (id: string) => void;
  
  // 未実装
  undo: () => void; // "Undo not implemented"
  redo: () => void; // "Redo not implemented"
}
```

## 3. 実装アーキテクチャ

### 3.1 コマンドパターンの実装

```typescript
// 基本コマンドインターフェース
interface Command {
  id: string;
  timestamp: number;
  description: string;
  execute(context: CommandContext): void;
  undo(context: CommandContext): void;
  redo?(context: CommandContext): void;
  canMerge?(other: Command): boolean;
  merge?(other: Command): Command;
}

// コマンドコンテキスト
interface CommandContext {
  store: WhiteboardStore;
  getState: () => WhiteboardState;
  setState: (updater: (state: WhiteboardState) => void) => void;
}
```

### 3.2 HistoryManagerクラス

```typescript
class HistoryManager {
  private commands: Command[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 100;
  private batchMode: boolean = false;
  private batchCommands: Command[] = [];
  
  execute(command: Command, context: CommandContext): void;
  undo(context: CommandContext): boolean;
  redo(context: CommandContext): boolean;
  beginBatch(): void;
  endBatch(description: string): void;
  clear(): void;
  
  get canUndo(): boolean;
  get canRedo(): boolean;
  get commandHistory(): ReadonlyArray<Command>;
}
```

### 3.3 Zustandストアの拡張

```typescript
interface ExtendedWhiteboardStore extends WhiteboardStore {
  // 履歴管理
  history: HistoryManager;
  
  // コマンドベースのアクション
  executeCommand: (command: Command) => void;
  
  // 拡張されたUndo/Redo
  undo: () => boolean;
  redo: () => boolean;
  
  // 履歴状態
  canUndo: boolean;
  canRedo: boolean;
  
  // バッチ操作
  beginBatch: () => void;
  endBatch: (description: string) => void;
}
```

## 4. 実装フェーズ

### Phase 1: 基盤構築（推定工数: 2-3日）

#### 4.1.1 コマンド基盤の実装
**ファイル**: `packages/store/src/commands/base-command.ts`
```typescript
export abstract class BaseCommand implements Command {
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  constructor(description: string) {
    this.id = generateId();
    this.timestamp = Date.now();
    this.description = description;
  }
  
  abstract execute(context: CommandContext): void;
  abstract undo(context: CommandContext): void;
  
  redo(context: CommandContext): void {
    this.execute(context);
  }
}
```

#### 4.1.2 HistoryManagerの実装
**ファイル**: `packages/store/src/history/history-manager.ts`
- コマンドスタックの管理
- Undo/Redo操作の実装
- バッチ処理のサポート

#### 4.1.3 Zustandストアの拡張
**ファイル**: `packages/store/src/store.ts`
```typescript
const useWhiteboardStore = create<ExtendedWhiteboardStore>((set, get) => ({
  // 既存の状態...
  
  history: new HistoryManager(),
  
  executeCommand: (command) => {
    const context = createCommandContext(get, set);
    get().history.execute(command, context);
    set({ 
      canUndo: get().history.canUndo,
      canRedo: get().history.canRedo 
    });
  },
  
  undo: () => {
    const context = createCommandContext(get, set);
    const result = get().history.undo(context);
    set({ 
      canUndo: get().history.canUndo,
      canRedo: get().history.canRedo 
    });
    return result;
  },
  
  redo: () => {
    const context = createCommandContext(get, set);
    const result = get().history.redo(context);
    set({ 
      canUndo: get().history.canUndo,
      canRedo: get().history.canRedo 
    });
    return result;
  }
}));
```

### Phase 2: 基本コマンドの実装（推定工数: 3-4日）

#### 4.2.1 形状操作コマンド
**ディレクトリ**: `packages/store/src/commands/shape/`

- **CreateShapeCommand**
  ```typescript
  export class CreateShapeCommand extends BaseCommand {
    constructor(private shape: Shape) {
      super(`Create ${shape.type}`);
    }
    
    execute(context: CommandContext): void {
      context.setState((state) => {
        state.shapes[this.shape.id] = this.shape;
      });
    }
    
    undo(context: CommandContext): void {
      context.setState((state) => {
        delete state.shapes[this.shape.id];
        state.selectedShapeIds.delete(this.shape.id);
      });
    }
  }
  ```

- **DeleteShapeCommand**
  ```typescript
  export class DeleteShapeCommand extends BaseCommand {
    private deletedShape?: Shape;
    private wasSelected: boolean = false;
    
    constructor(private shapeId: string) {
      super(`Delete shape`);
    }
    
    execute(context: CommandContext): void {
      const state = context.getState();
      this.deletedShape = state.shapes[this.shapeId];
      this.wasSelected = state.selectedShapeIds.has(this.shapeId);
      
      context.setState((state) => {
        delete state.shapes[this.shapeId];
        state.selectedShapeIds.delete(this.shapeId);
      });
    }
    
    undo(context: CommandContext): void {
      if (this.deletedShape) {
        context.setState((state) => {
          state.shapes[this.shapeId] = this.deletedShape!;
          if (this.wasSelected) {
            state.selectedShapeIds.add(this.shapeId);
          }
        });
      }
    }
  }
  ```

- **UpdateShapeCommand**
  ```typescript
  export class UpdateShapeCommand extends BaseCommand {
    private previousState?: Partial<Shape>;
    
    constructor(
      private shapeId: string,
      private updates: Partial<Shape>
    ) {
      super(`Update shape`);
    }
    
    execute(context: CommandContext): void {
      const state = context.getState();
      const shape = state.shapes[this.shapeId];
      
      // 変更前の状態を保存
      this.previousState = {};
      Object.keys(this.updates).forEach(key => {
        this.previousState![key] = shape[key];
      });
      
      context.setState((state) => {
        state.shapes[this.shapeId] = {
          ...state.shapes[this.shapeId],
          ...this.updates
        };
      });
    }
    
    undo(context: CommandContext): void {
      if (this.previousState) {
        context.setState((state) => {
          state.shapes[this.shapeId] = {
            ...state.shapes[this.shapeId],
            ...this.previousState
          };
        });
      }
    }
    
    canMerge(other: Command): boolean {
      if (!(other instanceof UpdateShapeCommand)) return false;
      if (this.shapeId !== other.shapeId) return false;
      
      // 同じ形状の連続した更新はマージ可能
      const timeDiff = other.timestamp - this.timestamp;
      return timeDiff < 1000; // 1秒以内
    }
    
    merge(other: UpdateShapeCommand): Command {
      return new UpdateShapeCommand(
        this.shapeId,
        { ...this.updates, ...other.updates }
      );
    }
  }
  ```

#### 4.2.2 選択操作コマンド
**ディレクトリ**: `packages/store/src/commands/selection/`
- SelectShapeCommand
- DeselectShapeCommand
- ClearSelectionCommand

#### 4.2.3 カメラ操作コマンド
**ディレクトリ**: `packages/store/src/commands/camera/`
- SetCameraCommand（パン・ズーム操作）

### Phase 3: UI統合とキーボードショートカット（推定工数: 2日）

#### 4.3.1 キーボードショートカットの実装
**ファイル**: `packages/react-canvas/src/hooks/use-keyboard-shortcuts.ts`
```typescript
export function useKeyboardShortcuts() {
  const { undo, redo, canUndo, canRedo } = useWhiteboardStore();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z (Mac) / Ctrl+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      
      // Cmd+Shift+Z (Mac) / Ctrl+Shift+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canRedo) redo();
      }
      
      // Cmd+Y (Windows alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
```

#### 4.3.2 UIコンポーネントの作成
**ファイル**: `packages/ui-components/src/history-controls.tsx`
```typescript
export function HistoryControls() {
  const { undo, redo, canUndo, canRedo } = useWhiteboardStore();
  
  return (
    <div className="history-controls">
      <button
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Cmd+Z)"
      >
        <UndoIcon />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Cmd+Shift+Z)"
      >
        <RedoIcon />
      </button>
    </div>
  );
}
```

### Phase 4: 高度な機能（推定工数: 3-4日）

#### 4.4.1 バッチ操作
複数選択時の移動、削除などの一括操作をサポート

```typescript
// 使用例
store.beginBatch();
selectedShapes.forEach(shapeId => {
  store.executeCommand(new DeleteShapeCommand(shapeId));
});
store.endBatch("Delete selected shapes");
```

#### 4.4.2 コマンドのマージ
連続した同種の操作を1つのコマンドにマージ（ドラッグ操作など）

#### 4.4.3 メモリ管理
- 履歴サイズの制限（デフォルト: 100操作）
- 古いコマンドの自動削除
- メモリ使用量の最適化

## 5. テスト計画

### 5.1 単体テスト
**ファイル**: `packages/store/src/__tests__/`
- 各コマンドクラスのテスト
- HistoryManagerのテスト
- Zustandストア統合テスト

```typescript
describe('CreateShapeCommand', () => {
  it('should create a shape on execute', () => {
    const shape = createTestShape();
    const command = new CreateShapeCommand(shape);
    const context = createTestContext();
    
    command.execute(context);
    
    expect(context.getState().shapes[shape.id]).toBeDefined();
  });
  
  it('should remove the shape on undo', () => {
    const shape = createTestShape();
    const command = new CreateShapeCommand(shape);
    const context = createTestContext();
    
    command.execute(context);
    command.undo(context);
    
    expect(context.getState().shapes[shape.id]).toBeUndefined();
  });
});
```

### 5.2 統合テスト
**ファイル**: `packages/e2e-tests/tests/undo-redo.spec.ts`
- キーボードショートカットのテスト
- UIボタンのテスト
- 複雑な操作シーケンスのテスト

### 5.3 パフォーマンステスト
- 大量の操作履歴でのパフォーマンス
- メモリ使用量の監視
- Undo/Redo応答時間の測定

## 6. 移行計画

### 6.1 既存コードの移行
既存の直接的な状態変更をコマンドベースに移行：

**Before:**
```typescript
// 直接的な状態変更
store.addShape(newShape);
```

**After:**
```typescript
// コマンドベースの状態変更
store.executeCommand(new CreateShapeCommand(newShape));
```

### 6.2 後方互換性の維持
移行期間中は両方のAPIをサポート：
```typescript
addShape: (shape: Shape) => {
  // 内部でコマンドを使用
  get().executeCommand(new CreateShapeCommand(shape));
}
```

## 7. リスクと対策

### 7.1 パフォーマンスリスク
**リスク**: 大量の操作履歴によるメモリ使用量増加
**対策**: 
- 履歴サイズの制限（100操作）
- 軽量なコマンドオブジェクトの設計
- 必要最小限の状態保存

### 7.2 複雑性リスク
**リスク**: コマンドパターンによるコードの複雑化
**対策**:
- 明確な抽象化レイヤー
- 包括的なドキュメント
- ヘルパー関数の提供

### 7.3 統合リスク
**リスク**: XStateツールシステムとの統合問題
**対策**:
- 段階的な統合
- 独立したテスト
- フォールバック機構

## 8. 成功指標

### 8.1 機能要件
- ✅ Cmd+Z / Cmd+Shift+Zでのundo/redo
- ✅ 100操作までの履歴保持
- ✅ バッチ操作のサポート
- ✅ UIボタンでの操作

### 8.2 パフォーマンス要件
- Undo/Redo操作: < 50ms
- メモリ使用量: < 50MB（100操作時）
- CPU使用率: < 5%（アイドル時）

### 8.3 品質要件
- テストカバレッジ: > 90%
- バグ率: < 1 bug/1000 LOC
- ドキュメントカバレッジ: 100%

## 9. タイムライン

### Week 1
- **Day 1-2**: Phase 1 - 基盤構築
- **Day 3-5**: Phase 2 - 基本コマンド実装

### Week 2  
- **Day 6-7**: Phase 3 - UI統合
- **Day 8-9**: Phase 4 - 高度な機能
- **Day 10**: テストと最適化

### Week 3
- **Day 11-12**: 統合テスト
- **Day 13-14**: パフォーマンス最適化
- **Day 15**: リリース準備

## 10. 次のステップ

1. **技術レビュー**: この計画書のレビューと承認
2. **環境準備**: 開発環境とテスト環境のセットアップ
3. **Phase 1開始**: BaseCommandとHistoryManagerの実装
4. **週次進捗報告**: 各フェーズ完了時の報告

## 付録A: API仕様

### コマンドAPI
```typescript
// コマンドの作成と実行
const command = new CreateShapeCommand(shape);
store.executeCommand(command);

// Undo/Redo
store.undo();
store.redo();

// バッチ操作
store.beginBatch();
// ... 複数のコマンド実行
store.endBatch("Batch operation");

// 状態確認
const { canUndo, canRedo } = store;
const history = store.history.commandHistory;
```

## 付録B: 設定オプション

```typescript
interface HistoryOptions {
  maxSize: number;        // デフォルト: 100
  mergeThreshold: number; // デフォルト: 1000ms
  enableCompression: boolean; // デフォルト: false
  enableSnapshots: boolean;   // デフォルト: false
}
```

## 付録C: 参考資料

- [Command Pattern - Design Patterns](https://refactoring.guru/design-patterns/command)
- [Implementing Undo/Redo - Redux](https://redux.js.org/usage/implementing-undo-history)
- [Memory Management Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

---

**ドキュメント情報**
- 作成日: 2025-09-18
- バージョン: 1.0.0
- ステータス: レビュー待ち
- 作成者: uSketch開発チーム