# 複数選択機能 実装計画書

## 📋 概要

現在のuSketchは単一のシェイプのみ選択可能ですが、本計画では複数シェイプの同時選択・操作を可能にする機能を実装します。

## 🎯 目標

- **複数シェイプの同時選択**: Shift+クリック、ドラッグ選択（ラバーバンド）による複数選択
- **一括操作**: 選択した複数シェイプの移動、削除、スタイル変更
- **視覚的フィードバック**: 選択状態の明確な表示、選択範囲の可視化
- **パフォーマンス**: 大量のシェイプ選択時でも高速動作

## 📊 現状分析

### 現在の実装状況

1. **Store (`@usketch/store`)**
   - `selectedShapeIds: Set<string>` - 既に複数選択対応のデータ構造
   - `selectShape()`, `deselectShape()`, `clearSelection()` - 基本的な選択操作API

2. **SelectTool (`@usketch/tools`)**
   - XState v5による状態管理
   - ブラシ選択（ラバーバンド）の基本実装あり
   - 複数シェイプの移動処理実装済み

3. **Canvas (`@usketch/canvas-core`)**
   - SelectionLayerによる選択表示
   - イベントハンドリング基盤

### 課題と改善点

1. **Shift+クリックによる追加選択が未実装**
2. **選択範囲（バウンディングボックス）の表示が未実装**
3. **複数選択時のUIフィードバック不足**
4. **キーボードショートカット（Ctrl/Cmd+A）未対応**

## 🏗️ アーキテクチャ設計

### 全体構成

```
┌─────────────────────────────────────────┐
│           User Interaction              │
│    (Click, Shift+Click, Drag, Keys)    │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│         ToolManager (XState)            │
│   - SelectTool State Machine            │
│   - Multi-selection logic               │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│       WhiteboardStore (Zustand)         │
│   - selectedShapeIds: Set<string>       │
│   - Selection state management          │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│        SelectionLayer (UI)              │
│   - Selection box rendering             │
│   - Multi-shape bounding box            │
└─────────────────────────────────────────┘
```

### 状態遷移図

```
idle
  ├─[Shift+Click on shape]→ addToSelection
  ├─[Click on shape]→ singleSelection
  ├─[Drag on empty]→ brushSelection
  └─[Ctrl/Cmd+A]→ selectAll

brushSelection
  ├─[Dragging]→ updateSelectionBox
  └─[Release]→ finalizeSelection → idle

multiSelected
  ├─[Drag selected]→ translating
  ├─[Click outside]→ clearSelection → idle
  └─[Delete]→ deleteSelected → idle
```

## 📝 実装タスク

### Phase 1: 基本的な複数選択 (2-3日)

#### 1.1 Shift+クリック選択
- [ ] SelectToolにShiftキー検知を追加
- [ ] 追加/削除のトグル動作実装
- [ ] ストアの選択状態更新

#### 1.2 Ctrl/Cmd+A 全選択
- [ ] キーボードイベントハンドラー追加
- [ ] 全シェイプ選択アクション実装

#### 1.3 選択解除の改善
- [ ] ESCキーでの選択解除
- [ ] 空白クリックでの選択解除

### Phase 2: ビジュアルフィードバック (2日)

#### 2.1 複数選択時のバウンディングボックス
- [ ] 選択シェイプ群の外接矩形計算
- [ ] SelectionLayerでの描画実装
- [ ] リサイズハンドル表示（将来の拡張用）

#### 2.2 選択状態の視覚的強調
- [ ] 選択シェイプのハイライト強化
- [ ] ホバー時のプレビュー表示
- [ ] 選択数のカウンター表示

### Phase 3: ドラッグ選択の改善 (1-2日)

#### 3.1 ラバーバンド選択の最適化
- [ ] 選択矩形のスタイリング改善
- [ ] 交差判定アルゴリズムの最適化
- [ ] リアルタイム選択プレビュー

#### 3.2 選択モードオプション
- [ ] 完全包含 vs 部分交差モード
- [ ] 追加選択モード（Shift+ドラッグ）

### Phase 4: 一括操作機能 (2日)

#### 4.1 移動操作の最適化
- [ ] 複数シェイプの同時移動（実装済みの改善）
- [ ] スナップ機能の複数選択対応
- [ ] パフォーマンス最適化

#### 4.2 一括編集
- [ ] 複数選択時のプロパティパネル
- [ ] スタイル一括変更
- [ ] 一括削除の確認ダイアログ

### Phase 5: 高度な機能 (オプション)

#### 5.1 選択のグループ化
- [ ] 選択グループの保存
- [ ] グループ単位での操作
- [ ] グループの入れ子対応

#### 5.2 選択フィルター
- [ ] タイプ別選択（矩形のみ、フリードローのみ等）
- [ ] 条件付き選択（色、サイズ等）

## 🔧 実装詳細

### 1. SelectTool State Machine の更新

```typescript
// machines/selectTool.ts の更新案

export interface SelectToolContext extends ToolContext {
  // 既存
  selectedIds: Set<string>;
  
  // 追加
  isShiftPressed: boolean;
  isCtrlPressed: boolean;
  selectionMode: 'replace' | 'add' | 'toggle';
  groupBounds: Bounds | null;  // 複数選択時の外接矩形
}

// イベントの追加
export type SelectToolEvent =
  | { type: "POINTER_DOWN"; point: Point; shiftKey: boolean; ctrlKey: boolean }
  | { type: "KEY_DOWN"; key: string; shiftKey: boolean; ctrlKey: boolean }
  | { type: "SELECT_ALL" }
  // ... 既存のイベント
```

### 2. Store の拡張

```typescript
// store/store.ts の更新案

export interface WhiteboardStore extends WhiteboardState {
  // 追加メソッド
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  getSelectionBounds: () => Bounds | null;
  
  // 選択状態の詳細情報
  selectionInfo: {
    count: number;
    bounds: Bounds | null;
    commonType: string | null;
  };
}
```

### 3. SelectionLayer の機能拡張

```typescript
// ui-components/selection-layer.ts の更新案

export class SelectionLayer {
  // 複数選択時のバウンディングボックス描画
  renderGroupSelection(bounds: Bounds): void {
    // 外接矩形の描画
    // リサイズハンドルの配置
    // 選択数の表示
  }
  
  // ラバーバンド選択の描画
  renderSelectionBox(bounds: Bounds): void {
    // 半透明の選択矩形
    // アニメーション効果
  }
}
```

## 🧪 テスト計画

### ユニットテスト

1. **Store のテスト**
   - 複数選択の追加/削除
   - 全選択/全解除
   - 選択状態の整合性

2. **SelectTool のテスト**
   - Shiftキー動作
   - ドラッグ選択
   - 状態遷移の正確性

### E2Eテスト

1. **基本操作**
   - Shift+クリックで複数選択
   - ドラッグで範囲選択
   - Ctrl/Cmd+Aで全選択

2. **複合操作**
   - 複数選択→移動→選択解除
   - 選択→削除→Undo
   - 大量シェイプのパフォーマンス

## 📊 パフォーマンス考慮事項

### 最適化ポイント

1. **選択状態の管理**
   - Set構造による高速な追加/削除
   - 選択数のキャッシュ
   - バウンディングボックスの遅延計算

2. **レンダリング最適化**
   - 選択レイヤーの独立管理
   - 変更差分のみ再描画
   - requestAnimationFrameの活用

3. **大量選択への対応**
   - 仮想化による表示最適化
   - バッチ処理による一括更新
   - Web Workerでの重い計算

## 🎨 UI/UXガイドライン

### 視覚的フィードバック

1. **選択状態の表示**
   - 選択シェイプ: 青いアウトライン + コーナーハンドル
   - ホバー: 薄い青のハイライト
   - 複数選択: 統合バウンディングボックス

2. **インタラクション**
   - Shift+クリック: 追加/削除トグル
   - ドラッグ: ラバーバンド選択
   - ダブルクリック: 編集モード（将来実装）

3. **アクセシビリティ**
   - キーボード操作完全対応
   - スクリーンリーダー対応
   - 高コントラストモード

## 📅 実装スケジュール

| Phase | タスク | 期間 | 優先度 |
|-------|--------|------|--------|
| 1 | 基本的な複数選択 | 2-3日 | 高 |
| 2 | ビジュアルフィードバック | 2日 | 高 |
| 3 | ドラッグ選択の改善 | 1-2日 | 中 |
| 4 | 一括操作機能 | 2日 | 中 |
| 5 | 高度な機能 | - | 低 |

**合計見積もり**: 7-9日（Phase 1-4）

## 🚀 デプロイメント計画

1. **開発環境でのテスト** (1日)
2. **コードレビュー** (0.5日)
3. **ステージング環境での検証** (0.5日)
4. **本番デプロイ** (0.5日)

## 📚 参考資料

- [tldraw - Multiple Selection](https://github.com/tldraw/tldraw)
- [Figma - Selection System](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [XState v5 - Parallel States](https://stately.ai/docs/parallel-states)
- [React - Performance Optimization](https://react.dev/reference/react)

## ✅ 完了条件

- [ ] Shift+クリックで複数選択が可能
- [ ] ドラッグで範囲選択が可能
- [ ] Ctrl/Cmd+Aで全選択が可能
- [ ] 複数選択したシェイプを一括移動可能
- [ ] 複数選択したシェイプを一括削除可能
- [ ] パフォーマンステスト合格（100シェイプで60fps維持）
- [ ] E2Eテスト全項目合格
- [ ] ドキュメント更新完了