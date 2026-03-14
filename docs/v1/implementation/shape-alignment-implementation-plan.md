# Shape整列機能実装計画書（改訂版）

## 改訂履歴
- 2025-09-15: 実装失敗の原因分析を踏まえた大幅改訂

## 概要

uSketchにShape同士の整列機能を実装します。Shapeを移動する際に、他のShapeとの位置関係に基づいてガイドラインを表示し、スナップ（吸い付き）を行う機能です。

## ⚠️ 過去の実装失敗の原因分析

### 根本原因
1. **SnapEngineが完全に空実装** - 整列計算ロジックが存在しない
2. **XStateアクター通信の断絶** - イベントの送受信が実装されていない
3. **WhiteboardStoreに整列機能が欠落** - 必要なアクションと状態が未定義
4. **UIコンポーネントの不在** - 整列操作のためのインターフェースが存在しない
5. **イベントフローの設計不備** - 各層での処理が連携していない

### 失敗を防ぐための対策
- **段階的な実装と検証** - 各フェーズごとに動作確認を徹底
- **最小限の動作する実装から開始** - 複雑な機能は後回し
- **既存コードとの統合を重視** - 新規実装より既存システムの拡張を優先

## 機能要件

### 基本機能
1. **整列ガイドライン表示**
   - Shape移動時に他のShapeとの整列ポイントでガイドラインを表示
   - 垂直・水平の両方向に対応

2. **スナップポイント**
   - 上辺（top）
   - 中央（center - vertical/horizontal）
   - 下辺（bottom）
   - 左辺（left）
   - 右辺（right）

3. **スナップ動作**
   - ガイドラインが表示される範囲内（スナップ閾値）で自動的に位置が調整される
   - スムーズな吸い付き感を実現

### 操作方法
- **通常モード**: Shapeドラッグ時に自動的に整列機能が有効
- **一時無効化**: Altキーを押しながらドラッグで整列機能を無効化
- **強制スナップ**: Shiftキーを押しながらドラッグでより強いスナップ

## 技術設計

### アーキテクチャ

```
┌─────────────────────────────────────────────┐
│           SelectTool (XState)               │
│  ┌─────────────────────────────────────┐   │
│  │        dragging state                │   │
│  │  ┌─────────────────────────────┐    │   │
│  │  │   AlignmentEngine           │    │   │
│  │  │  - calculateAlignments()    │    │   │
│  │  │  - findSnapPoints()         │    │   │
│  │  └─────────────────────────────┘    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         WhiteboardStore (Zustand)           │
│  - alignmentGuides: AlignmentGuide[]        │
│  - snapEnabled: boolean                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      AlignmentLayer (React Component)       │
│  - ガイドラインのレンダリング                 │
│  - アニメーション制御                        │
└─────────────────────────────────────────────┘
```

### 主要コンポーネント

#### 1. AlignmentEngine (`packages/tools/src/utils/alignment-engine.ts`)
既存の`SnapEngine`を拡張・置き換え

```typescript
interface AlignmentPoint {
  x: number;  // X座標（垂直ガイド用）
  y: number;  // Y座標（水平ガイド用）
  type: 'top' | 'center-vertical' | 'bottom' | 'left' | 'center-horizontal' | 'right';
  shapeId: string;
}

interface AlignmentGuide {
  id: string;
  type: 'vertical' | 'horizontal';
  position: number;
  start: Point;
  end: Point;
  alignedShapes: string[];
}

class AlignmentEngine {
  private snapThreshold = 8; // pixels
  private strongSnapThreshold = 15; // Shift key pressed
  
  calculateAlignments(
    movingShape: Shape,
    targetShapes: Shape[],
    options: AlignmentOptions
  ): {
    snappedPosition: Point;
    guides: AlignmentGuide[];
  }
  
  private findSnapPoints(
    shape: Shape,
    targetShapes: Shape[]
  ): AlignmentPoint[]
  
  private calculateSnapOffset(
    current: number,
    targets: AlignmentPoint[],
    threshold: number
  ): number | null
}
```

#### 2. SelectTool拡張 (`packages/tools/src/tools/select-tool.ts`)

```typescript
// Context拡張（最小限の状態のみ保持）
interface SelectToolContext extends ToolContext {
  // 既存のプロパティ...
  // 注: alignmentGuidesとsnapEnabledはWhiteboardStoreから取得
  alignmentEngine: AlignmentEngine; // エンジンインスタンスのみ保持
}

// dragging state内での処理
dragging: {
  on: {
    POINTER_MOVE: {
      actions: [
        'updateDragPosition',
        'calculateAndStoreAlignment', // Store経由で状態更新
      ]
    }
  },
  exit: {
    actions: ['clearAlignmentGuides'] // Store経由でガイドをクリア
  }
}

// アクション実装
calculateAndStoreAlignment: (context, event) => {
  const { alignmentEngine } = context;
  const store = whiteboardStore.getState();
  
  // AlignmentEngineで計算
  const result = alignmentEngine.calculateAlignments(
    movingShape,
    targetShapes,
    { snapEnabled: store.alignmentConfig.enabled }
  );
  
  // Storeに結果を保存（単一の真実の源）
  store.setAlignmentGuides(result.guides);
  
  // スナップ位置を適用
  return result.snappedPosition;
}
```

#### 3. AlignmentLayer (`packages/react-canvas/src/layers/alignment-layer.tsx`)

```typescript
// PropsはStoreから直接取得するため最小限
interface AlignmentLayerProps {
  camera: Camera;
}

export const AlignmentLayer: React.FC<AlignmentLayerProps> = ({ camera }) => {
  // Storeから直接ガイド情報を取得（単一の真実の源）
  const guides = useWhiteboardStore(state => state.alignmentGuides);
  const config = useWhiteboardStore(state => state.alignmentConfig);
  
  // ガイド表示が無効な場合は何も表示しない
  if (!config.showGuides || guides.length === 0) {
    return null;
  }
  
  return (
    <svg className="alignment-layer">
      {guides.map(guide => (
        <AlignmentGuideLine
          key={guide.id}
          guide={guide}
          camera={camera}
        />
      ))}
    </svg>
  );
};
```

#### 4. Store拡張 (`packages/store/src/store.ts`)

```typescript
interface WhiteboardStore {
  // 既存のプロパティ...
  
  // Alignment関連（単一の真実の源として中央管理）
  alignmentGuides: AlignmentGuide[];
  alignmentConfig: {
    enabled: boolean;
    snapThreshold: number;
    showGuides: boolean;
    strongSnapModifier: 'shift' | 'ctrl' | 'alt';
    disableModifier: 'alt' | 'ctrl' | 'shift';
  };
  
  // Actions（全てのコンポーネントがこれらを使用）
  setAlignmentGuides: (guides: AlignmentGuide[]) => void;
  clearAlignmentGuides: () => void;
  updateAlignmentConfig: (config: Partial<AlignmentConfig>) => void;
  
  // Computed getters
  isAlignmentActive: () => boolean;
  getActiveGuides: () => AlignmentGuide[];
}
```

**状態管理の原則:**
- WhiteboardStoreが整列状態の単一の真実の源
- SelectToolは計算のみ実行し、結果をStoreに保存
- UIコンポーネントはStoreから状態を読み取るのみ
- 状態の重複を完全に排除

## 実装ステップ

### Phase 1: 基盤実装（2-3日）
1. **AlignmentEngine実装**
   - [ ] 基本的な整列点計算ロジック
   - [ ] スナップ判定アルゴリズム
   - [ ] ガイドライン生成

2. **Store拡張**
   - [ ] 整列関連の状態追加
   - [ ] アクション実装

### Phase 2: SelectTool統合（2日）
1. **ドラッグ処理の拡張**
   - [ ] AlignmentEngineの統合
   - [ ] キーボード修飾キーの処理
   - [ ] スナップ位置の適用

2. **パフォーマンス最適化**
   - [ ] 計算の最適化（必要なShapeのみ対象）
   - [ ] デバウンス処理

### Phase 3: UI実装（2日）
1. **AlignmentLayerコンポーネント**
   - [ ] ガイドラインレンダリング
   - [ ] アニメーション実装
   - [ ] スタイリング

2. **WhiteboardCanvas統合**
   - [ ] レイヤー追加
   - [ ] z-index管理

### Phase 4: 拡張機能（1-2日）
1. **複数Shape選択時の対応**
   - [ ] グループ整列
   - [ ] 内部整列

2. **設定UI**
   - [ ] スナップのON/OFF切り替え
   - [ ] 閾値調整

### Phase 5: テスト・最適化（1-2日）
1. **ユニットテスト**
   - [ ] AlignmentEngineのテスト
   - [ ] SelectToolのテスト

2. **E2Eテスト**
   - [ ] 整列動作のテスト
   - [ ] キーボード操作のテスト

## パフォーマンス考慮事項

1. **計算の最適化**
   - 視界内のShapeのみを対象とする
   - 空間インデックス（QuadTree等）の導入検討
   - 計算結果のキャッシュ

2. **レンダリング最適化**
   - ガイドラインは別レイヤーでレンダリング
   - React.memoによる不要な再レンダリング防止
   - requestAnimationFrameによるスムーズな更新

## UI/UXデザイン

### ガイドライン表示
- **線のスタイル**: 破線（dashed）
- **色**: 青系（#2196F3）
- **太さ**: 1px
- **アニメーション**: フェードイン/アウト（200ms）

### スナップフィードバック
- **視覚的フィードバック**: ガイドライン表示
- **触覚的フィードバック**: スナップ時の微妙な「吸い付き」感

## 既存システムへの影響

### 影響を受けるパッケージ
- `@usketch/tools`: AlignmentEngine追加、SelectTool修正
- `@usketch/store`: 整列関連の状態追加
- `@usketch/react-canvas`: AlignmentLayer追加
- `@usketch/shared-types`: 整列関連の型定義追加

### 後方互換性
- 既存の機能に影響を与えない
- デフォルトで整列機能は有効（設定で無効化可能）

## リスクと対策

### リスク
1. **パフォーマンス低下**
   - 多数のShapeがある場合の計算負荷
   - 対策: 空間インデックスの導入、視界外のShape除外

2. **UXの複雑化**
   - 意図しないスナップによる操作性低下
   - 対策: 適切な閾値設定、キーボードショートカットでの制御

3. **既存機能との競合**
   - グリッドスナップとの競合
   - 対策: 優先順位の明確化、設定による切り替え

## 参考実装

### 類似機能を持つアプリケーション
- **Figma**: Smart Selection, Auto Layout
- **Sketch**: Smart Guides
- **Adobe XD**: Alignment Guides
- **Miro/Mural**: Object Snapping

### アルゴリズム参考資料
- Sweep Line Algorithm for alignment detection
- R-Tree for spatial indexing
- Snap-to-grid algorithms

## まとめ

この整列機能により、uSketchでの図形配置がより正確かつ効率的になります。実装は段階的に進め、各フェーズでテストを行いながら品質を確保します。

推定実装期間: **8-10営業日**

## 次のステップ

1. この計画書のレビューと承認
2. AlignmentEngineのプロトタイプ実装
3. SelectToolへの統合
4. UIコンポーネントの実装
5. テストとリファインメント