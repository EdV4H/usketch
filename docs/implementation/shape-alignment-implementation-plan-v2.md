# Shape整列機能実装計画書（改訂版v2）

## 改訂履歴
- 2025-09-15: 実装失敗の原因分析を踏まえた大幅改訂

## 概要
uSketchにShape同士の整列機能を実装します。過去の実装失敗の原因分析に基づき、**確実に動作する最小限の実装から段階的に機能を拡張**する方針に転換しました。

## ⚠️ 過去の実装失敗の原因分析

### 根本原因
1. **SnapEngineが完全に空実装** - 整列計算ロジックが存在しない（`return position`のみ）
2. **XStateアクター通信の断絶** - `UPDATE_POSITION`イベントの送信コードが存在しない
3. **WhiteboardStoreに整列機能が欠落** - 整列用のアクションと状態が未定義
4. **UIコンポーネントの不在** - 整列操作のためのインターフェースが存在しない
5. **イベントフローの設計不備** - 各層での処理が連携していない

### 失敗を防ぐための対策
- **段階的な実装と検証** - 各ステップごとに動作確認を徹底
- **最小限の動作する実装から開始** - 複雑な機能は後回し
- **既存コードとの統合を重視** - 新規実装より既存システムの拡張を優先

## 🎯 新しい実装戦略

### Phase 0: 即座に動作する最小実装（MVP）
**目標**: キーボードショートカットで選択中のShapeを整列できる最小機能

### Phase 1: 基本機能の実装
**目標**: SnapEngineを実装し、ドラッグ時のスナップを有効化

### Phase 2: UI統合
**目標**: 整列ボタンとビジュアルフィードバックを追加

## 📝 詳細実装計画

### Phase 0: MVP実装（1日）

#### 0.1 SelectToolに整列イベントを追加

```typescript
// packages/tools/src/tools/select-tool.ts

// イベント定義を追加
export type SelectToolEvent = 
  // 既存のイベント...
  | { type: "ALIGN_LEFT" }
  | { type: "ALIGN_CENTER_H" }
  | { type: "ALIGN_RIGHT" }
  | { type: "ALIGN_TOP" }
  | { type: "ALIGN_CENTER_V" }
  | { type: "ALIGN_BOTTOM" };

// selected状態に整列処理を追加
selected: {
  on: {
    // 既存のイベント...
    ALIGN_LEFT: {
      guard: ({ context }) => context.selectedIds.size > 1,
      actions: 'alignShapesLeft'
    },
    ALIGN_CENTER_H: {
      guard: ({ context }) => context.selectedIds.size > 1,
      actions: 'alignShapesCenterHorizontal'
    },
    // 他の整列イベントも同様...
  }
}

// 補助関数の定義
const calculateBounds = (shapes: Shape[]): { left: number; right: number; top: number; bottom: number } => {
  const xs = shapes.flatMap(s => [s.x, s.x + (s.width ?? 0)]);
  const ys = shapes.flatMap(s => [s.y, s.y + (s.height ?? 0)]);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };
};

// アクション実装（DIパターンを使用）
const createAlignmentActions = (getStore: () => WhiteboardStore) => ({
  alignShapesLeft: ({ context }) => {
    const store = getStore();
    const selectedShapes = Array.from(context.selectedIds)
      .map(id => store.shapes.get(id))
      .filter(Boolean);
    
    if (selectedShapes.length < 2) return;
    
    // 最も左のShapeを基準に整列
    // 最も左のShapeを基準に整列
    const leftMost = Math.min(...selectedShapes.map(s => s.x));
    
    selectedShapes.forEach(shape => {
      store.updateShape(shape.id, { x: leftMost });
    });
  },
  
  alignShapesCenterHorizontal: ({ context }) => {
    const store = getStore();
    const selectedShapes = Array.from(context.selectedIds)
      .map(id => store.shapes.get(id))
      .filter(Boolean);
    
    if (selectedShapes.length < 2) return;
    
    // 選択範囲の中心を計算
    const bounds = calculateBounds(selectedShapes);
    const centerX = (bounds.left + bounds.right) / 2;
    
    selectedShapes.forEach(shape => {
      // widthが存在しない場合のデフォルト値を設定
      const width = shape.width ?? 0;
      const shapeCenter = shape.x + width / 2;
      const offset = centerX - shapeCenter;
      store.updateShape(shape.id, { x: shape.x + offset });
    });
  },
  // 他の整列アクションも同様に実装...
});

// 使用例:ストアを注入してアクションを作成
const actions = createAlignmentActions(() => whiteboardStore.getState());
```

#### 0.2 キーボードショートカットの追加

```typescript
// packages/react-canvas/src/hooks/use-keyboard-shortcuts.ts

const alignmentShortcuts = {
  'ctrl+shift+ArrowLeft': () => sendEvent({ type: 'ALIGN_LEFT' }),
  'ctrl+shift+ArrowRight': () => sendEvent({ type: 'ALIGN_RIGHT' }),
  'ctrl+shift+ArrowUp': () => sendEvent({ type: 'ALIGN_TOP' }),
  'ctrl+shift+ArrowDown': () => sendEvent({ type: 'ALIGN_BOTTOM' }),
  'ctrl+shift+c': () => sendEvent({ type: 'ALIGN_CENTER_H' }),
  'ctrl+shift+m': () => sendEvent({ type: 'ALIGN_CENTER_V' }),
};
```

#### 0.3 動作確認
- 複数のShapeを選択
- キーボードショートカットで整列を実行
- 正しく整列されることを確認

### Phase 1: SnapEngine実装（2日）

#### 1.1 SnapEngineの基本実装

```typescript
// packages/tools/src/utils/snap-engine.ts

export class SnapEngine {
  private gridSize = 10;
  private snapThreshold = 8;
  
  // Step 1: グリッドスナップの実装
  snap(position: Point, options?: SnapOptions): Point {
    if (!options?.snapEnabled) return position;
    
    if (options.gridSnap) {
      return {
        x: Math.round(position.x / this.gridSize) * this.gridSize,
        y: Math.round(position.y / this.gridSize) * this.gridSize
      };
    }
    
    return position;
  }
  
  // Step 2: Shape間スナップの追加
  snapToShapes(
    movingShape: Shape,
    targetShapes: Shape[],
    currentPosition: Point
  ): SnapResult {
    const snapPoints = this.findSnapPoints(movingShape, targetShapes);
    const snappedPosition = this.calculateSnappedPosition(
      currentPosition,
      snapPoints
    );
    
    return {
      position: snappedPosition,
      guides: this.generateGuides(snapPoints)
    };
  }
  
  // 整列計算メソッド（Phase 0のロジックを移植）
  calculateAlignment(
    shapes: Shape[],
    alignment: AlignmentType
  ): Map<string, Point> {
    const updates = new Map<string, Point>();
    
    switch (alignment) {
      case 'left':
        const leftMost = Math.min(...shapes.map(s => s.x));
        shapes.forEach(shape => {
          updates.set(shape.id, { x: leftMost, y: shape.y });
        });
        break;
      // 他のケースも実装...
    }
    
    return updates;
  }
}
```

#### 1.2 SelectToolとの統合

```typescript
// packages/tools/src/tools/select-tool.ts

// translating状態でSnapEngineを使用
translating: {
  invoke: {
    id: 'snappingService',
    src: fromCallback(({ sendBack, receive }) => {
      const snapEngine = new SnapEngine();
      
      receive((event: any) => {
        if (event.type === "SNAP_REQUEST") {
          const result = snapEngine.snap(event.position, {
            snapEnabled: true,
            gridSnap: event.gridSnap
          });
          sendBack({ type: "SNAP_RESPONSE", position: result });
        }
      });
    })
  },
  on: {
    POINTER_MOVE: {
      actions: [
        // SnapEngineにリクエストを送信
        send(
          ({ event }) => ({
            type: 'SNAP_REQUEST',
            position: event.position,
            gridSnap: true
          }),
          { to: 'snappingService' }
        )
      ]
    },
    SNAP_RESPONSE: {
      actions: 'updateSnappedPosition'
    }
  }
}
```

### Phase 2: UI統合（2日）

#### 2.1 整列ツールバーコンポーネント

```typescript
// packages/ui-components/src/alignment-toolbar.tsx

export const AlignmentToolbar: React.FC<AlignmentToolbarProps> = ({
  onAlign,
  selectedCount
}) => {
  if (selectedCount < 2) return null;
  
  return (
    <div className="alignment-toolbar">
      <button onClick={() => onAlign('left')} title="Align Left">
        <AlignLeftIcon />
      </button>
      <button onClick={() => onAlign('center-h')} title="Align Center">
        <AlignCenterHIcon />
      </button>
      <button onClick={() => onAlign('right')} title="Align Right">
        <AlignRightIcon />
      </button>
      <Separator />
      <button onClick={() => onAlign('top')} title="Align Top">
        <AlignTopIcon />
      </button>
      <button onClick={() => onAlign('center-v')} title="Align Middle">
        <AlignCenterVIcon />
      </button>
      <button onClick={() => onAlign('bottom')} title="Align Bottom">
        <AlignBottomIcon />
      </button>
    </div>
  );
};
```

#### 2.2 SelectionLayerとの統合

```typescript
// packages/react-canvas/src/layers/selection-layer.tsx

// イベントタイプマッピング
const ALIGNMENT_EVENT_MAP: Record<AlignmentType, string> = {
  'left': 'ALIGN_LEFT',
  'center-h': 'ALIGN_CENTER_H',
  'right': 'ALIGN_RIGHT',
  'top': 'ALIGN_TOP',
  'center-v': 'ALIGN_CENTER_V',
  'bottom': 'ALIGN_BOTTOM',
};

export const SelectionLayer: React.FC = () => {
  const selectedIds = useWhiteboardStore(state => state.selectedIds);
  const sendEvent = useToolManager();
  
  const handleAlign = (alignment: AlignmentType) => {
    const eventType = ALIGNMENT_EVENT_MAP[alignment];
    if (!eventType) {
      console.warn(`Unknown alignment type: ${alignment}`);
      return;
    }
    sendEvent({ type: eventType });
  };
  
  return (
    <>
      {selectedIds.size > 1 && (
        <AlignmentToolbar
          selectedCount={selectedIds.size}
          onAlign={handleAlign}
        />
      )}
      {/* 既存の選択ハンドル */}
      <SelectionHandles />
    </>
  );
};
```

### Phase 3: ガイドライン表示（オプション・3日）

後続フェーズとして、以下の高度な機能を追加：
- ドラッグ中のガイドライン表示
- スナップアニメーション
- 等間隔分布機能
- グループ整列

## 🔍 実装チェックリスト

### Phase 0（MVP）
- [ ] SelectToolに整列イベントを追加
- [ ] 整列アクションの実装（直接的な位置更新）
- [ ] キーボードショートカットの設定
- [ ] 複数Shape選択時の動作確認
- [ ] 各整列方向の動作テスト

### Phase 1（基本機能）
- [ ] SnapEngineの基本実装
- [ ] グリッドスナップ機能
- [ ] Shape間スナップ機能
- [ ] SelectToolとの統合
- [ ] translating状態でのスナップ動作確認

### Phase 2（UI統合）
- [ ] AlignmentToolbarコンポーネント作成
- [ ] SelectionLayerとの統合
- [ ] ツールバーの表示/非表示制御
- [ ] UIからの整列実行テスト

## 📊 成功指標

### Phase 0
- キーボードショートカットで整列が実行できる
- 選択した全てのShapeが正しく整列される
- 既存機能への影響がない

### Phase 1
- ドラッグ時にグリッドスナップが動作する
- Shape間のスナップが機能する

### Phase 2
- UIから整列操作ができる
- ユーザビリティが向上する

## ⚠️ リスクと対策

### 技術的リスク
1. **XState v5の複雑性**
   - 対策: シンプルなアクションから始める
   
2. **Zustandの状態更新**
   - 対策: 既存のupdateShapeメソッドを使用
   
3. **パフォーマンス問題**
   - 対策: 最初は最適化せず、動作を優先

### 実装上の注意点
- **既存コードを最大限活用** - 新規実装を最小限に
- **段階的にテスト** - 各フェーズで動作確認
- **コミットを細かく** - 問題発生時にロールバック可能に

## 📅 推定スケジュール

- Phase 0: 1日（即座に成果を確認）
- Phase 1: 2日（基本機能の完成）
- Phase 2: 2日（ユーザー向け機能）
- **合計: 5営業日**（従来の8-10日から短縮）

## 🚀 次のアクション

1. **Phase 0の実装を即座に開始**
2. 動作確認後、Phase 1へ進む
3. 各フェーズで成果を確認しながら進める

この改訂版では、**確実に動作する最小実装から始め、段階的に機能を追加**することで、過去の失敗を避けながら着実に整列機能を実装します。