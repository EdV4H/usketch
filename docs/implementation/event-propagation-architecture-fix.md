# イベント伝播アーキテクチャ修正計画書

## 1. 現状の問題

### 1.1 問題の概要
現在のWhiteboardアプリケーションでは、以下の機能間でイベント処理の競合が発生している：

1. **Shift+Click複数選択機能** - `shape-layer.tsx`で直接処理
2. **XState駆動の選択ツール** - `select-tool.ts`でステートマシンで処理  
3. **Snap機能** - XStateマシンを経由してスナップ計算を実行

### 1.2 根本原因
- **イベント処理の重複**: 同じPointerEventを複数の場所で処理しようとしている
- **責務の不明確さ**: どのレイヤーがどのイベントを処理すべきか明確でない
- **相互依存**: shape-layer.tsxが直接Store操作とXStateツール両方を知っている

### 1.3 具体的な競合ケース

```typescript
// shape-layer.tsx - 現在の問題のあるコード
const handleShapePointerDown = (shapeId: string, e: React.PointerEvent) => {
  // 問題1: ここでShift+Click選択を処理
  if (e.shiftKey) {
    store.setSelection(...); // 直接Store操作
    return; // XStateへの伝播を止める → Snapが効かない
  }
  
  // 問題2: ドラッグ開始も直接処理
  setDragState(...); // ローカルState管理
  
  // 問題3: XStateツールへの伝播が不完全
  // toolHandlers.handlePointerDown(...); // コメントアウトされている
}
```

## 2. 設計の問題点

### 2.1 アーキテクチャの問題
```
現在の構造（問題あり）:
┌─────────────────────┐
│   shape-layer.tsx   │ ←── 複数の責務を持つ
├─────────────────────┤
│ - Shift+Click選択   │
│ - ドラッグ処理      │
│ - Store直接操作    │
│ - 部分的なXState連携│
└─────────────────────┘
          ↓ 不完全な伝播
┌─────────────────────┐
│  select-tool.ts     │
├─────────────────────┤
│ - XStateマシン      │
│ - Snap計算         │
│ - その他のツール機能│
└─────────────────────┘
```

### 2.2 データフローの問題
1. **双方向の依存**: UIレイヤーがビジネスロジック（選択、ドラッグ）を持つ
2. **イベントの分岐**: 一部はXStateへ、一部は直接Store操作
3. **状態の分散**: ドラッグ状態がローカル、選択状態がグローバル

## 3. 解決策

### 3.1 提案するアーキテクチャ

```
理想的な構造:
┌─────────────────────┐
│   shape-layer.tsx   │ ←── UIレイヤー（表示のみ）
├─────────────────────┤
│ - イベント転送のみ  │
│ - 表示更新        │
└─────────────────────┘
          ↓ 全イベント転送
┌─────────────────────┐
│  useToolMachine     │ ←── 統合Hook
├─────────────────────┤
│ - イベントルーティング│
│ - Store連携        │
└─────────────────────┘
          ↓
┌─────────────────────┐
│  select-tool.ts     │ ←── ツール固有ロジック
├─────────────────────┤
│ - XStateマシン      │
│ - 選択ロジック      │
│ - ドラッグ処理      │
│ - Snap計算         │
└─────────────────────┘
          ↕ 双方向通信
┌─────────────────────┐
│  whiteboardStore    │ ←── グローバル状態管理
│    (Zustand)        │
├─────────────────────┤
│ - shapes           │
│ - selectedShapeIds  │
│ - camera           │
│ - activeTool       │
└─────────────────────┘
```

### 3.2 Zustand Storeとの責務分担

#### Zustand Store（グローバル永続状態）
```typescript
// whiteboardStore.ts
interface WhiteboardStore {
  // 永続的なデータ
  shapes: Record<string, Shape>;
  selectedShapeIds: Set<string>;
  camera: CameraState;
  activeTool: ToolType;
  
  // アクション（最終的な状態変更）
  setSelection: (ids: string[]) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  addShape: (shape: Shape) => void;
  deleteShapes: (ids: string[]) => void;
  
  // Snap設定などのグローバル設定
  snapSettings: {
    enabled: boolean;
    gridSize: number;
    magneticDistance: number;
  };
}
```

#### XState（一時的な操作状態）
```typescript
// select-tool.ts
interface SelectToolContext {
  // 一時的な操作状態
  dragState: {
    isDragging: boolean;
    startPoint: Point;
    currentPoint: Point;
    originalPositions: Map<string, Point>;
  } | null;
  
  // 操作中の計算結果
  snapTarget: {
    point: Point;
    type: 'grid' | 'guide' | 'magnetic';
  } | null;
  
  // ツール固有の一時状態
  selectionBox: {
    start: Point;
    end: Point;
  } | null;
}
```

### 3.3 データフローと同期

#### イベントフロー例：Shift+Click選択
```typescript
// 1. UIレイヤーがイベントを受信
shape-layer.tsx: onPointerDown(e) 
  ↓
// 2. XStateマシンに転送
useToolMachine: send({ type: 'POINTER_DOWN', shiftKey: true })
  ↓
// 3. XStateが状態遷移とアクションを実行
select-tool.ts: {
  guard: 'isShiftClick',
  actions: ['toggleShapeSelection']
}
  ↓
// 4. アクション内でZustand Storeを更新
action: (context, event) => {
  const store = whiteboardStore.getState();
  const newSelection = toggleSelection(store.selectedShapeIds, event.shapeId);
  store.setSelection(newSelection);
}
  ↓
// 5. Zustand Storeの変更がUIに反映
shape-layer.tsx: 自動的に再レンダリング
```

#### イベントフロー例：ドラッグ中のSnap
```typescript
// 1. ドラッグ開始
shape-layer.tsx: onPointerDown → XState: 'POINTER_DOWN'
  ↓
// 2. XStateがドラッグ状態を管理（Zustand Storeは未更新）
select-tool.ts: context.dragState = { isDragging: true, ... }
  ↓
// 3. ドラッグ中（マウス移動）
shape-layer.tsx: onPointerMove → XState: 'POINTER_MOVE'
  ↓
// 4. XStateがSnap計算を実行（一時的な位置）
select-tool.ts: {
  actions: ['calculateSnapPosition', 'updateTemporaryPosition']
}
  ↓
// 5. 一時的な位置でプレビュー表示（Storeは未更新）
useToolMachine: temporaryPositions を返す
shape-layer.tsx: プレビュー表示に使用
  ↓
// 6. ドラッグ終了時にStoreを更新
select-tool.ts: onPointerUp → action: 'commitDragToStore'
  ↓
// 7. 最終位置をZustand Storeに保存
whiteboardStore: updateShape(id, finalPosition)
```

### 3.4 XStateとZustandの連携パターン

#### パターン1: XStateからZustandへの書き込み
```typescript
// select-tool.ts
const selectToolMachine = setup({
  actions: {
    updateSelection: (context, event) => {
      // XStateからZustand Storeを直接更新
      const store = whiteboardStore.getState();
      store.setSelection(Array.from(context.selectedIds));
    },
    
    commitShapePosition: (context) => {
      // ドラッグ終了時に確定
      const store = whiteboardStore.getState();
      context.dragState?.affectedShapes.forEach(({ id, position }) => {
        store.updateShape(id, { x: position.x, y: position.y });
      });
    }
  }
});
```

#### パターン2: ZustandからXStateへの読み込み
```typescript
// use-tool-machine.ts
export const useToolMachine = () => {
  const { shapes, selectedShapeIds, snapSettings } = useWhiteboardStore();
  const [state, send] = useMachine(selectToolMachine, {
    // Zustand StoreのデータをXStateに注入
    input: {
      shapes,
      selectedShapeIds,
      snapSettings
    }
  });
  
  // Snap計算時にZustandのデータを参照
  const calculateSnap = (point: Point) => {
    const { gridSize, magneticDistance } = snapSettings;
    return snapEngine.calculate(point, shapes, { gridSize, magneticDistance });
  };
  
  return { state, send, calculateSnap };
};
```

### 3.5 実装方針

#### Phase 1: XStateマシンの拡張
```typescript
// select-tool.ts - 拡張版
export const selectToolMachine = setup({
  types: {
    context: {} as {
      selectedIds: Set<string>;
      dragState: DragState | null; // ドラッグ状態もXStateで管理
      snapTarget: SnapTarget | null;
    },
    events: {} as
      | { type: 'POINTER_DOWN'; point: Point; shapeId?: string; shiftKey: boolean }
      | { type: 'POINTER_MOVE'; point: Point }
      | { type: 'POINTER_UP'; point: Point }
      | { type: 'DRAG_START'; shapeId: string; point: Point }
      | { type: 'DRAG_MOVE'; point: Point }
      | { type: 'DRAG_END' }
  }
}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        POINTER_DOWN: [
          {
            guard: 'isShiftClick',
            actions: 'toggleSelection', // Shift+Click処理
            target: 'idle' // ドラッグしない
          },
          {
            guard: 'isOnShape',
            actions: 'selectShape',
            target: 'readyToDrag' // ドラッグ準備状態へ
          }
        ]
      }
    },
    
    readyToDrag: {
      on: {
        POINTER_MOVE: {
          guard: 'hasMovedEnough',
          actions: 'startDrag',
          target: 'dragging'
        },
        POINTER_UP: {
          target: 'idle'
        }
      }
    },
    
    dragging: {
      entry: 'calculateSnapTargets',
      on: {
        POINTER_MOVE: {
          actions: ['updateDragPosition', 'applySnapIfNeeded']
        },
        POINTER_UP: {
          actions: 'finalizeDrag',
          target: 'idle'
        }
      }
    }
  }
});
```

#### Phase 2: shape-layer.tsxの簡素化
```typescript
// shape-layer.tsx - 簡素化版
const ShapeLayer = ({ shapes, camera, activeTool }) => {
  const toolMachine = useToolMachine();
  
  const handleShapePointerDown = (shapeId: string, e: React.PointerEvent) => {
    // すべてのイベントをXStateに転送
    toolMachine.send({
      type: 'POINTER_DOWN',
      point: screenToCanvas(e.clientX, e.clientY),
      shapeId,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey
    });
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    toolMachine.send({
      type: 'POINTER_MOVE',
      point: screenToCanvas(e.clientX, e.clientY)
    });
  };
  
  // レンダリングロジックのみ
  return (
    <svg>
      {shapes.map(shape => (
        <Shape
          key={shape.id}
          shape={shape}
          onPointerDown={(e) => handleShapePointerDown(shape.id, e)}
        />
      ))}
    </svg>
  );
};
```

#### Phase 3: useToolMachineの強化
```typescript
// use-tool-machine.ts
export const useToolMachine = () => {
  const selectToolActor = useActor(selectToolMachine);
  const { shapes, updateShape } = useWhiteboardStore();
  
  // XStateのコンテキストをSubscribe
  const dragState = useSelector(selectToolActor, state => state.context.dragState);
  const snapTarget = useSelector(selectToolActor, state => state.context.snapTarget);
  
  // ドラッグ中の形状位置を自動更新
  useEffect(() => {
    if (dragState && dragState.isDragging) {
      const updates = calculateShapeUpdates(dragState, snapTarget);
      updates.forEach(({ id, position }) => updateShape(id, position));
    }
  }, [dragState, snapTarget]);
  
  return {
    send: selectToolActor.send,
    state: selectToolActor.state,
    dragState,
    snapTarget
  };
};
```

## 4. 移行計画

### 4.1 段階的移行ステップ

1. **Step 1**: XStateマシンにShift+Click選択ロジックを追加
2. **Step 2**: XStateマシンにドラッグ状態管理を追加
3. **Step 3**: shape-layer.tsxからローカル状態を削除
4. **Step 4**: すべてのイベントをXState経由に統一
5. **Step 5**: Snap機能をドラッグ処理に統合

### 4.2 テスト戦略

1. **単体テスト**: XStateマシンの各状態遷移をテスト
2. **統合テスト**: イベントフローの完全性を確認
3. **E2Eテスト**: 全機能が正常動作することを確認

## 5. リスクと対策

### 5.1 リスク
1. **パフォーマンス**: すべてのイベントがXStateを経由
2. **複雑性**: XStateマシンが巨大化
3. **既存機能への影響**: 大規模な変更による regression

### 5.2 対策
1. **パフォーマンス最適化**: 
   - イベントのスロットリング
   - 選択的な再レンダリング
   
2. **マシンの分割**:
   - 選択マシンとドラッグマシンを分離
   - コンポジションで組み合わせ
   
3. **段階的リリース**:
   - Feature flagで新旧切り替え
   - 段階的なロールアウト

## 6. 実装優先順位

1. **高優先度**:
   - XStateマシンへのShift+Click統合
   - イベント伝播の修正
   
2. **中優先度**:
   - ドラッグ状態のXState管理
   - Snap機能の統合
   
3. **低優先度**:
   - パフォーマンス最適化
   - リファクタリング

## 7. 結論

現在の問題は、UIレイヤーとビジネスロジックレイヤーの責務が混在していることに起因しています。XStateとZustand Storeを適切に連携させることで、以下のメリットが得られます：

### 責務の明確化

1. **UIレイヤー（React Components）**
   - イベントの受信と転送
   - 表示の更新
   - ユーザーフィードバック

2. **XState（ツール固有ロジック）**
   - 一時的な操作状態（ドラッグ、選択ボックス）
   - 状態遷移ロジック
   - Snap計算などのリアルタイム処理
   - イベントハンドリングの統一

3. **Zustand Store（グローバル状態）**
   - 永続的なデータ（shapes、selection）
   - アプリケーション全体の設定
   - Undo/Redo対象となる状態
   - 複数コンポーネント間で共有される状態

### 重要な設計原則

1. **単一方向のイベントフロー**: UI → XState → Zustand Store
2. **状態の分離**: 一時状態（XState）と永続状態（Zustand）
3. **責務の分離**: 各レイヤーが明確な役割を持つ
4. **テスタビリティ**: 各レイヤーを独立してテスト可能

この設計により、Shift+Click選択、ドラッグ、Snap機能すべてが調和して動作し、将来の機能拡張も容易になります。