# Tool State Unification Plan

## 概要

現在、ツール状態管理において `currentTool` と `activeTool` の2つのプロパティが存在しているが、実質的に同じ役割を果たしており冗長となっている。これらを単一の `currentTool` に統合することで、コードの簡潔性と保守性を向上させる。

## 現状分析

### 2つの状態が存在する箇所

#### Store定義 (packages/store/src/store.ts)
- **currentTool**: WhiteboardStateの一部として定義 (line 223)
- **activeTool**: WhiteboardStoreの追加プロパティ (line 77, 224)
- **setCurrentTool()**: line 304-306
- **setActiveTool()**: line 308-310

#### 主な使用箇所

1. **packages/react-canvas/**
   - `use-interaction.ts`: currentToolを取得し、ローカルでactiveToolを作成
   - `use-tool-machine.ts`: currentToolのみ使用
   - `interaction-layer.tsx`: activeToolを受け取って処理
   - `use-selection-indicator.ts`: activeToolを引数として受け取る

2. **apps/whiteboard/**
   - `toolbar-react.tsx`: currentToolとsetCurrentToolのみ使用

3. **packages/tools/**
   - `tool-manager-adapter.ts`: setActiveToolでcurrentToolを更新 (line 136)

### 現在の問題点

1. **概念の重複**: 両者はほぼ同じタイミングで更新され、実質的に同じ値を持つ
2. **不整合のリスク**: 2つの状態が同期されない可能性がある
3. **API の混乱**: どちらを使うべきか開発者が迷う
4. **不要な複雑性**: ローカル変数でactiveToolを再定義している箇所がある

## 統合による影響範囲

### 低リスク変更
- Store内部の実装
- React Hooksの内部実装
- ToolManager内部の実装

### 中リスク変更
- interaction-layer.tsx のプロパティ変更
- use-selection-indicator.ts の引数変更

### 高リスク変更
- なし（外部APIへの影響なし）

## 懸念点と対策

### 懸念点1: 将来的な拡張性

**懸念**: ツールのプレビュー状態やサスペンド状態など、将来的に異なる状態が必要になる可能性

**対策**: 
- 必要になった時点で `toolPreview` や `suspendedTool` など、明確に異なる概念として追加
- 現時点で使用されていない概念を予防的に残すことは YAGNI原則に反する

### 懸念点2: XState統合での役割分離

**懸念**: XStateとUIの状態を分離する設計意図があった可能性

**対策**:
- 現在のコードではその分離が活用されていない
- XStateの内部状態は状態マシン内で管理し、currentToolは外部インターフェースとする

### 懸念点3: 移行時の破壊的変更

**懸念**: activeToolを使用している箇所でエラーが発生する可能性

**対策**:
- 段階的な移行計画（下記参照）
- 型システムによるコンパイル時チェック
- 包括的なテストカバレッジの確認

## リファクタリング計画

### Phase 1: 準備 (破壊的変更なし)

1. **非推奨マーク追加** 
   ```typescript
   // store.ts
   /** @deprecated Use currentTool instead */
   activeTool: string;
   
   /** @deprecated Use setCurrentTool instead */
   setActiveTool: (tool: string) => void;
   ```

2. **setActiveToolをsetCurrentToolのエイリアスに変更**
   ```typescript
   setActiveTool: (tool: string) => {
     set((state) => ({ 
       ...state, 
       currentTool: tool,
       activeTool: tool  // 一時的に両方更新
     }));
   }
   ```

### Phase 2: 内部実装の移行

1. **React Hooksの更新**
   ```typescript
   // use-interaction.ts
   const { currentTool, camera, setCamera } = useWhiteboardStore();
   // activeToolのローカル定義を削除
   ```

2. **Componentプロパティの更新**
   ```typescript
   // interaction-layer.tsx
   - activeTool,
   + currentTool,
   
   // use-selection-indicator.ts
   - export function useSelectionIndicator(activeTool: string | undefined) {
   + export function useSelectionIndicator(currentTool: string | undefined) {
   ```

3. **ToolManagerの更新**
   ```typescript
   // tool-manager-adapter.ts
   setActiveTool(toolId: string, updateStore = true): void {
     // ...
     if (updateStore) {
       whiteboardStore.setState({ currentTool: toolId });
       // activeTool更新を削除
     }
   }
   ```

### Phase 3: クリーンアップ

1. **Store定義から削除**
   ```typescript
   // activeTool プロパティを削除
   // setActiveTool メソッドを削除（または currentTool への単純なエイリアスとして残す）
   ```

2. **テスト更新**
   - activeTool を参照するテストを currentTool に変更

3. **ドキュメント更新**
   - API ドキュメントから activeTool への参照を削除
   - 移行ガイドの作成

### Phase 4: 検証

1. **単体テスト実行**
   ```bash
   pnpm test
   ```

2. **E2Eテスト実行**
   ```bash
   pnpm test:e2e
   ```

3. **型チェック**
   ```bash
   pnpm typecheck
   ```

4. **リグレッションテスト**
   - ツール切り替え機能
   - Undo/Redo機能
   - XState統合

## タイムライン

- **Phase 1**: 即座に実施可能（破壊的変更なし）
- **Phase 2**: 1-2日（内部実装の慎重な更新）
- **Phase 3**: 1日（クリーンアップとテスト）
- **Phase 4**: 1日（検証とバグ修正）

**合計見積もり**: 3-5日

## 成功基準

1. ✅ 単一の `currentTool` でツール状態を管理
2. ✅ 既存の機能が全て正常に動作
3. ✅ テストカバレッジの維持または向上
4. ✅ TypeScript エラーゼロ
5. ✅ パフォーマンス劣化なし

## リスク評価

- **リスクレベル**: 低〜中
- **影響範囲**: 内部実装のみ（外部APIへの影響は最小限）
- **ロールバック**: Git revertで容易に戻せる

## 代替案

### 代替案1: 現状維持
- メリット: 変更リスクゼロ
- デメリット: 技術的負債の蓄積、混乱の継続

### 代替案2: activeToolのみを残す
- メリット: より明確な命名
- デメリット: WhiteboardStateの変更が必要、より大きな破壊的変更

### 推奨案: currentToolへの統合
- WhiteboardStateの既存構造を維持
- 段階的移行が可能
- 破壊的変更を最小限に抑える

## 結論

`currentTool` と `activeTool` の統合は、コードベースの簡潔性と保守性を大幅に向上させる。段階的な移行計画により、リスクを最小限に抑えながら実施可能である。現時点で明確な使い分けがされていないため、統合によるデメリットよりもメリットの方が大きいと判断される。