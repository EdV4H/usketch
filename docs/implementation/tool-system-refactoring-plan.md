# Tool System リファクタリング計画書

## 🎯 概要

現在のToolシステムを、StateMachineベースのモジュラブルなアーキテクチャに改修し、開発者が簡単にカスタムToolを追加できるようにする。

## 📊 現状分析

### 現在の実装の問題点

1. **状態管理の複雑さ**
   - 各Toolが独自に状態を管理（isDragging, dragStart等）
   - 状態遷移が暗黙的で追跡が困難
   - エラーが発生しやすい

2. **拡張性の制限**
   - 新しいToolの追加にはコアコードの理解が必要
   - Tool間の共通処理の再利用が困難
   - プラグインシステムが存在しない

3. **テスタビリティの低さ**
   - 状態遷移のテストが困難
   - イベントハンドリングのモック化が複雑

## 🏗️ 新アーキテクチャ設計

### コア概念

```typescript
// State Machine による Tool の状態管理
interface ToolState {
  idle: void;
  active: { data?: any };
  dragging: { startPoint: Point; currentPoint: Point };
  drawing: { shape: Shape };
  editing: { target: Shape };
}

// Modular Tool の基本構造
interface ModularTool<T extends ToolState = ToolState> {
  id: string;
  name: string;
  icon?: string;
  
  // State Machine
  stateMachine: StateMachine<T>;
  
  // Lifecycle Hooks
  hooks: ToolHooks;
  
  // Custom Actions
  actions: ToolActions;
  
  // Configuration
  config: ToolConfig;
}
```

### StateMachine実装

```typescript
class ToolStateMachine<States extends Record<string, any>> {
  private currentState: keyof States;
  private stateData: States[keyof States];
  private transitions: TransitionMap<States>;
  private listeners: StateListeners<States>;

  constructor(config: StateMachineConfig<States>) {
    this.currentState = config.initialState;
    this.transitions = config.transitions;
    this.listeners = {};
  }

  // 状態遷移
  transition(to: keyof States, data?: States[typeof to]): void {
    if (!this.canTransition(this.currentState, to)) {
      throw new Error(`Invalid transition: ${String(this.currentState)} -> ${String(to)}`);
    }

    const from = this.currentState;
    this.onExit(from);
    this.currentState = to;
    this.stateData = data;
    this.onEnter(to, data);
    this.notifyListeners(from, to, data);
  }

  // 現在の状態を取得
  getState(): { state: keyof States; data: States[keyof States] } {
    return { state: this.currentState, data: this.stateData };
  }

  // 遷移可能かチェック
  canTransition(from: keyof States, to: keyof States): boolean {
    return this.transitions[from]?.includes(to) ?? false;
  }

  // 状態変更のリスナー
  onStateChange(listener: StateChangeListener<States>): () => void {
    const id = Math.random().toString(36);
    this.listeners[id] = listener;
    return () => delete this.listeners[id];
  }

  private notifyListeners(from: keyof States, to: keyof States, data: any): void {
    Object.values(this.listeners).forEach(listener => {
      listener(from, to, data);
    });
  }

  private onEnter(state: keyof States, data: any): void {
    // Override in subclasses
  }

  private onExit(state: keyof States): void {
    // Override in subclasses
  }
}
```

### モジュラーToolの実装例

```typescript
// カスタムToolの作成例
class CustomDrawingTool extends ModularTool {
  constructor() {
    super({
      id: 'custom-drawing',
      name: 'Custom Drawing Tool',
      icon: 'pencil',
      
      // State Machine設定
      stateMachine: new ToolStateMachine({
        initialState: 'idle',
        transitions: {
          idle: ['drawing'],
          drawing: ['idle', 'editing'],
          editing: ['idle', 'drawing']
        }
      }),
      
      // ライフサイクルフック
      hooks: {
        onActivate: () => console.log('Tool activated'),
        onDeactivate: () => console.log('Tool deactivated'),
        beforeStateChange: (from, to) => {
          console.log(`Transitioning from ${from} to ${to}`);
          return true; // Allow transition
        },
        afterStateChange: (from, to) => {
          console.log(`Transitioned from ${from} to ${to}`);
        }
      },
      
      // カスタムアクション
      actions: {
        startDrawing: (point: Point) => {
          this.stateMachine.transition('drawing', { startPoint: point });
        },
        
        updateDrawing: (point: Point) => {
          const state = this.stateMachine.getState();
          if (state.state === 'drawing') {
            // Update drawing logic
          }
        },
        
        finishDrawing: () => {
          this.stateMachine.transition('idle');
        }
      },
      
      // 設定
      config: {
        strokeWidth: 2,
        strokeColor: '#000000',
        fillColor: 'transparent'
      }
    });
  }
  
  // イベントハンドラー（StateMachineベース）
  onPointerDown(event: PointerEvent, worldPos: Point): void {
    const state = this.stateMachine.getState();
    
    switch (state.state) {
      case 'idle':
        this.actions.startDrawing(worldPos);
        break;
      case 'editing':
        // Handle editing logic
        break;
    }
  }
  
  onPointerMove(event: PointerEvent, worldPos: Point): void {
    const state = this.stateMachine.getState();
    
    if (state.state === 'drawing') {
      this.actions.updateDrawing(worldPos);
    }
  }
  
  onPointerUp(event: PointerEvent, worldPos: Point): void {
    const state = this.stateMachine.getState();
    
    if (state.state === 'drawing') {
      this.actions.finishDrawing();
    }
  }
}
```

## 🔧 実装フェーズ

### フェーズ1: Core StateMachine実装（1週間）

1. **StateMachine基盤クラスの実装**
   - 状態管理
   - 遷移ルール
   - イベントリスナー
   - エラーハンドリング

2. **ToolStateMachine拡張**
   - Tool特有の状態定義
   - 共通遷移パターン
   - デバッグ機能

3. **テストスイート**
   - StateMachineユニットテスト
   - 状態遷移テスト
   - エッジケーステスト

### フェーズ2: ModularTool基盤（1週間）

1. **ModularTool基底クラス**
   - ライフサイクル管理
   - フック システム
   - アクション システム
   - 設定管理

2. **ToolRegistry**
   - Tool登録システム
   - 依存関係管理
   - 遅延ロード対応

3. **ToolComposer**
   - Tool合成機能
   - ミックスイン対応
   - 継承チェーン管理

### フェーズ3: 既存Toolの移行（1週間）

1. **SelectToolの移行**
   - StateMachine化
   - モジュール化
   - 後方互換性確保

2. **RectangleToolの移行**
   - 描画状態の管理
   - プレビュー機能
   - スナップ機能追加

3. **移行ガイドライン作成**
   - ベストプラクティス
   - アンチパターン
   - トラブルシューティング

### フェーズ4: Plugin System（1週間）

1. **Plugin API設計**
   ```typescript
   interface ToolPlugin {
     id: string;
     version: string;
     tools: ModularTool[];
     dependencies?: string[];
     
     install(registry: ToolRegistry): void;
     uninstall(registry: ToolRegistry): void;
   }
   ```

2. **Plugin Manager**
   - プラグインのロード
   - 依存関係解決
   - バージョン管理
   - サンドボックス化

3. **Plugin Marketplace準備**
   - メタデータ仕様
   - 配布形式
   - セキュリティポリシー

## 📝 API設計

### Tool作成API

```typescript
// シンプルなTool作成
const simpleTool = createTool({
  id: 'my-tool',
  name: 'My Tool',
  
  states: {
    idle: {},
    active: { cursor: 'crosshair' }
  },
  
  handlers: {
    onPointerDown: (ctx, event) => {
      ctx.setState('active');
      // Handle pointer down
    },
    
    onPointerUp: (ctx, event) => {
      ctx.setState('idle');
      // Handle pointer up
    }
  }
});

// 高度なTool作成
const advancedTool = createAdvancedTool({
  id: 'advanced-tool',
  name: 'Advanced Tool',
  
  // State Machine定義
  stateMachine: {
    initial: 'idle',
    states: {
      idle: {
        on: {
          START: 'drawing'
        }
      },
      drawing: {
        on: {
          MOVE: 'drawing',
          END: 'idle'
        },
        entry: 'startDrawing',
        exit: 'endDrawing'
      }
    }
  },
  
  // アクション定義
  actions: {
    startDrawing: (context, event) => {
      console.log('Start drawing');
    },
    
    endDrawing: (context, event) => {
      console.log('End drawing');
    }
  },
  
  // ガード条件
  guards: {
    canDraw: (context, event) => {
      return context.hasPermission && !context.isLocked;
    }
  }
});
```

### Tool合成API

```typescript
// ベースToolから拡張
const extendedTool = extendTool(baseTool, {
  id: 'extended-tool',
  name: 'Extended Tool',
  
  // 追加の状態
  additionalStates: {
    preview: { opacity: 0.5 }
  },
  
  // 追加のハンドラー
  additionalHandlers: {
    onDoubleClick: (ctx, event) => {
      // Handle double click
    }
  }
});

// 複数Toolの合成
const compositeTool = composeTool([
  selectCapability,
  drawCapability,
  transformCapability
], {
  id: 'composite-tool',
  name: 'Composite Tool'
});
```

## 🧪 テスト戦略

### StateMachineテスト

```typescript
describe('ToolStateMachine', () => {
  it('should transition between valid states', () => {
    const machine = new ToolStateMachine({
      initial: 'idle',
      transitions: {
        idle: ['active'],
        active: ['idle']
      }
    });
    
    expect(machine.getState().state).toBe('idle');
    machine.transition('active');
    expect(machine.getState().state).toBe('active');
  });
  
  it('should prevent invalid transitions', () => {
    const machine = new ToolStateMachine({
      initial: 'idle',
      transitions: {
        idle: ['active'],
        active: ['idle']
      }
    });
    
    expect(() => machine.transition('invalid')).toThrow();
  });
});
```

### カスタムToolテスト

```typescript
describe('CustomTool', () => {
  it('should handle pointer events correctly', () => {
    const tool = new CustomDrawingTool();
    const mockEvent = new PointerEvent('pointerdown');
    const worldPos = { x: 100, y: 100 };
    
    tool.onPointerDown(mockEvent, worldPos);
    expect(tool.stateMachine.getState().state).toBe('drawing');
    
    tool.onPointerUp(mockEvent, worldPos);
    expect(tool.stateMachine.getState().state).toBe('idle');
  });
});
```

## 📊 移行計画

### 後方互換性の確保

```typescript
// Legacy Tool Adapter
class LegacyToolAdapter extends ModularTool {
  constructor(legacyTool: Tool) {
    super({
      id: legacyTool.id,
      name: legacyTool.name,
      
      // Legacy methodsをStateMachineにマップ
      stateMachine: new ToolStateMachine({
        initial: 'idle',
        transitions: {
          idle: ['active'],
          active: ['idle']
        }
      }),
      
      // Legacy handlersをラップ
      handlers: {
        onPointerDown: (ctx, event, worldPos) => {
          legacyTool.onPointerDown(event, worldPos);
        },
        onPointerMove: (ctx, event, worldPos) => {
          legacyTool.onPointerMove(event, worldPos);
        },
        onPointerUp: (ctx, event, worldPos) => {
          legacyTool.onPointerUp(event, worldPos);
        }
      }
    });
  }
}
```

### 段階的移行

1. **Week 1-2**: 新システムを並行実装
2. **Week 3**: 既存Toolを新システムでラップ
3. **Week 4**: 段階的に内部実装を移行
4. **Week 5**: レガシーコード削除
5. **Week 6**: ドキュメント更新・リリース

## 🎯 成功指標

### パフォーマンス指標
- Tool切り替え時間: < 10ms
- イベント処理遅延: < 16ms（60fps維持）
- メモリ使用量: 既存比 -20%

### 開発者体験指標
- カスタムTool作成時間: < 30分
- コード行数削減: -40%
- テストカバレッジ: > 90%

### ユーザー体験指標
- Tool応答性向上: 体感速度 2倍
- バグ報告数: -50%
- 新機能リクエスト実装速度: 3倍

## 📚 参考資料

- [XState Documentation](https://xstate.js.org/)
- [State Pattern - Design Patterns](https://refactoring.guru/design-patterns/state)
- [tldraw Tool System](https://github.com/tldraw/tldraw)
- [Excalidraw Architecture](https://github.com/excalidraw/excalidraw)

## 🚀 次のステップ

1. この計画書のレビューと承認
2. ProofOfConceptの実装（3日間）
3. チームへのデモと FB収集
4. 実装開始

---

*最終更新: 2025-01-14*
*作成者: uSketch Development Team*