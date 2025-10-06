# ツールシステム統合の設計課題 (Tool System Integration Issue)

## 📋 Issue概要

**作成日**: 2025-10-06
**優先度**: 🔴 高 (High)
**カテゴリ**: アーキテクチャ / 技術的負債
**影響範囲**: `@usketch/tools`, `@usketch/react-canvas`, `apps/whiteboard`

### 問題の要約

uSketchには以下の**2つの独立したツールシステム**が存在し、統合されていない状態です:

1. **XState v5ベースのToolManagerシステム** (`@usketch/tools`) - 設計されているが使用されていない
2. **InteractionLayerのハードコードされた分岐処理** (`@usketch/react-canvas`) - 実際に使用されている

この二重実装により、以下の問題が発生しています:

- ツールの追加/修正時に2箇所のコードを変更する必要がある
- XState状態マシンが全く活用されていない
- ツールロジックがReactコンポーネントに密結合している
- ユニットテストが困難
- コードの保守性とスケーラビリティが低い

---

## 🔍 詳細な調査結果

### 1. XStateベースのToolManagerシステム

#### 実装状況

**場所**: `packages/tools/src/`

```
tools/
├── adapters/
│   ├── tool-manager-adapter.ts    # ToolManagerクラス (380行) ✅ 完全実装
│   └── tool-manager-compat.ts     # 互換レイヤー ✅
├── core/
│   └── tool-manager.ts            # XState v5 マシン (314行) ✅ 完全実装
├── tools/
│   ├── select-tool.ts             # XState状態マシン ✅
│   ├── rectangle-tool.ts          # XState状態マシン ✅
│   ├── drawing-tool.ts            # XState状態マシン ✅
│   ├── effect-tool.ts             # XState状態マシン ✅
│   └── pan-tool.ts                # XState状態マシン ✅
├── configs/
│   └── default-tools.ts           # ツール設定 ✅
└── schemas/
    └── tool-config.schema.ts      # Zod検証 ✅
```

#### 設計の特徴

**強み**:
- ✅ XState v5の型安全な状態マシン設計
- ✅ Zodによるツール設定のバリデーション
- ✅ プラグイン可能なツールシステム
- ✅ ツールのライフサイクル管理 (activate/deactivate)
- ✅ Behaviors API (beforePointerDown, onShapeCreated等)
- ✅ イベントフォワーディング機構

**主要API**:
```typescript
class ToolManager {
  setActiveTool(toolId: string): void
  handlePointerDown(event: PointerEvent, worldPos: Point): void
  handlePointerMove(event: PointerEvent, worldPos: Point): void
  handlePointerUp(event: PointerEvent, worldPos: Point): void
  handleKeyDown(event: KeyboardEvent): void
  getPreviewShape(): Shape | null
  addTool(config: ToolConfig): void
  removeTool(toolId: string): void
}
```

**状態マシンの例** (pan-tool.ts):
```typescript
export const panToolMachine = setup({
  types: {
    context: {} as PanToolContext,
    events: {} as PanToolEvent,
  },
  actions: {
    startPan: assign(({ context, event }) => {
      const camera = whiteboardStore.getState().camera;
      return {
        ...context,
        startPoint: event.point,
        initialViewport: { x: camera.x, y: camera.y },
        cursor: "grabbing" as const,
      };
    }),
    updateViewport: ({ context, event }) => {
      const dx = event.point.x - context.startPoint.x;
      const dy = event.point.y - context.startPoint.y;
      whiteboardStore.getState().setViewport({
        x: context.initialViewport.x - dx,
        y: context.initialViewport.y - dy,
      });
    },
    endPan: assign({ /* ... */ }),
  },
}).createMachine({
  id: "panTool",
  initial: "idle",
  states: {
    idle: {
      on: { POINTER_DOWN: { target: "panning", actions: ["startPan"] } }
    },
    panning: {
      on: {
        POINTER_MOVE: { actions: ["updateViewport"] },
        POINTER_UP: { target: "idle", actions: ["endPan"] },
      }
    },
  },
});
```

#### 使用状況

**実際の使用箇所**: **0箇所** ❌

```bash
# apps/whiteboard/src で検索
$ grep -r "ToolManager\|createToolManager" apps/whiteboard/src
# 結果: なし

# packages/react-canvas/src で検索
$ grep -r "ToolManager\|createToolManager" packages/react-canvas/src
# 結果: なし
```

**結論**: 完全に実装されているが、どこからも使用されていない。

---

### 2. InteractionLayerのハードコードされた分岐処理

#### 実装状況

**場所**: `packages/react-canvas/src/components/interaction-layer.tsx` (392行)

**現在の実装パターン**:
```typescript
export const InteractionLayer: React.FC<InteractionLayerProps> = ({
  camera,
  currentTool,  // ← Storeから受け取ったツール名 (文字列)
  // ...
}) => {
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x, y } = screenToCanvas(screenX, screenY);

    // ツールごとにif/else分岐 ← 問題点
    if (currentTool === "pan") {
      // パンツールのロジック (2025-10-06追加)
      setDragState({
        startX: screenX,
        startY: screenY,
        currentX: screenX,
        currentY: screenY,
        isDragging: true,
      });
    } else if (currentTool === "rectangle" || currentTool === "ellipse") {
      // 矩形/楕円ツールのロジック
      setDragState({
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        isDragging: true,
      });
    } else if (currentTool === "draw") {
      // 描画ツールのロジック
      pathRef.current = [`M ${x} ${y}`];
      setDrawPath(`M ${x} ${y}`);
      setDragState({ ...dragState, isDragging: true });
    }
    // ... 他のツール
  }, [currentTool, /* ... */]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging) return;

    // 再びツールごとに分岐
    if (currentTool === "pan") {
      const dx = screenX - dragState.startX;
      const dy = screenY - dragState.startY;
      setCamera({
        x: storeCamera.x + dx,
        y: storeCamera.y + dy,
      });
      setDragState((prev) => ({ ...prev, startX: screenX, startY: screenY }));
    } else if (currentTool === "rectangle" || currentTool === "ellipse") {
      setDragState((prev) => ({ ...prev, currentX: x, currentY: y }));
    } else if (currentTool === "draw") {
      pathRef.current.push(`L ${x} ${y}`);
      setDrawPath(pathRef.current.join(" "));
    }
  }, [currentTool, /* ... */]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // さらにツールごとに分岐してShapeを作成
    if (currentTool === "rectangle" || currentTool === "ellipse") {
      const width = Math.abs(x - dragState.startX);
      const height = Math.abs(y - dragState.startY);
      if (width > 5 && height > 5) {
        addShape({
          id: uuidv4(),
          type: currentTool === "ellipse" ? "ellipse" : "rectangle",
          x: minX,
          y: minY,
          width,
          height,
          // ...
        });
      }
    } else if (currentTool === "draw" && drawPath) {
      const bounds = calculatePathBounds(pathRef.current);
      if (bounds.width > 5 || bounds.height > 5) {
        addShape({
          id: uuidv4(),
          type: "freedraw",
          // ...
        });
      }
    }
  }, [currentTool, /* ... */]);

  // レンダリングも分岐
  if (currentTool === "select") {
    return <SelectionIndicatorComponent />;
  }
  if (currentTool === "effect") {
    return null;
  }
  if (currentTool === "pan") {
    return <div /* ... */ />;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* SVGプレビューレンダリングもツールごとに分岐 */}
      {dragState.isDragging && (
        <svg>
          {currentTool === "rectangle" && <rect /* ... */ />}
          {currentTool === "ellipse" && <ellipse /* ... */ />}
          {currentTool === "draw" && <path /* ... */ />}
        </svg>
      )}
    </div>
  );
};
```

#### 問題点

**1. ツールロジックの集中化**
- すべてのツールロジックが1つのコンポーネントに集約 (392行)
- 新しいツールを追加するたびにInteractionLayerを編集
- ツール間の依存関係が不明確

**2. 責務の混在**
```
InteractionLayer.tsx:
- イベントハンドリング (handlePointerDown/Move/Up)
- ツールロジック (pan, rectangle, ellipse, draw, select, effect)
- プレビューレンダリング (SVG)
- カーソル管理 (getCursor)
- 座標変換 (screenToCanvas)
```

**3. 状態管理の複雑化**
- `dragState`: ドラッグ状態
- `drawPath`: 描画パス (drawツール専用)
- `pathRef`: パスの参照 (drawツール専用)
- ツールごとに異なる状態を1つのコンポーネントで管理

**4. テスタビリティの欠如**
- ツールロジックがReactコンポーネントに密結合
- ユニットテストが困難 (E2Eテストのみ可能)
- XStateのビジュアライゼーションツールが使えない

**5. 型安全性の不足**
```typescript
// 現在: ツール名は単なる文字列
currentTool: string  // "pan" | "rectangle" | "ellipse" | ...

// ToolManagerの場合: 型安全なイベント
type PanToolEvent =
  | { type: "POINTER_DOWN"; point: Point }
  | { type: "POINTER_MOVE"; point: Point }
  | { type: "POINTER_UP"; point: Point }
```

---

### 3. 使用箇所の比較

#### ToolManager (XState)の使用状況

```bash
# ToolManagerを使用しているファイル
$ grep -r "new ToolManager\|ToolManager(" --include="*.ts" --include="*.tsx" apps/
# 結果: 0件

# ToolManager自体の定義とドキュメント
packages/tools/src/adapters/tool-manager-adapter.ts  # 実装
docs/api/README.md                                   # APIドキュメント
docs/implementation/xstate-tool-system-design.md     # 設計書
docs/architecture/whiteboard-integration-architecture.md  # 統合計画
```

**結論**: 完璧に設計・実装されているが、実際のアプリケーションでは全く使用されていない。

#### InteractionLayerの使用状況

```bash
# InteractionLayerを使用しているファイル
packages/react-canvas/src/components/whiteboard-canvas.tsx  # ← ここで使用

# whiteboard-canvas.tsx からの使用例
<InteractionLayer
  camera={camera}
  currentTool={currentTool}  // ← storeから取得した文字列
  selectionIndicator={selectionIndicator}
  className={className}
/>
```

**結論**: すべてのツール処理がInteractionLayerで行われている。

---

## 🎯 設計上の問題点まとめ

### 問題1: 二重実装 (Dual Implementation)

```
ツールの定義が2箇所に存在:
1. packages/tools/src/tools/*.ts          ← XState状態マシン (未使用)
2. packages/react-canvas/src/components/
   interaction-layer.tsx                  ← if/else分岐 (使用中)
```

**影響**:
- 新しいツール (例: pan) を追加する際、両方を更新する必要がある
- 一貫性の欠如: XStateマシンは更新されるが、InteractionLayerが更新されないと動作しない
- 保守コストの増加

### 問題2: 状態管理の分散 (Distributed State Management)

```
ツール状態の管理が3箇所に分散:
1. @usketch/store                         ← currentTool: string
2. @usketch/tools (XState)               ← ToolManagerContext (未使用)
3. InteractionLayer (React State)        ← dragState, drawPath (使用中)
```

**影響**:
- 状態の同期が困難
- デバッグが複雑
- XStateのタイムトラベルデバッグが使えない

### 問題3: 責務の不明確さ (Unclear Responsibilities)

```
現在の責務分担:

InteractionLayer (392行):
├─ イベントハンドリング          ← 本来の責務
├─ ツールロジック (全ツール)     ← ToolManagerの責務
├─ 座標変換                      ← ユーティリティの責務
├─ プレビューレンダリング        ← 本来の責務
└─ カーソル管理                  ← ツール状態の責務

ToolManager (380行):
├─ ツールライフサイクル管理      ← 設計通り
├─ イベントディスパッチ          ← 設計通り
├─ 状態マシン管理                ← 設計通り
└─ プラグイン機構                ← 設計通り
(しかし全く使用されていない)
```

### 問題4: スケーラビリティの欠如 (Lack of Scalability)

新しいツールを追加する場合の手順:

**現状** (InteractionLayerパターン):
```typescript
1. handlePointerDownに分岐を追加
2. handlePointerMoveに分岐を追加
3. handlePointerUpに分岐を追加
4. getCursorに分岐を追加
5. レンダリング分岐を追加
6. プレビューSVGレンダリングを追加
→ 6箇所の変更が必要 (392行のファイルに集中)
```

**理想** (ToolManagerパターン):
```typescript
1. 新しいツールマシンを作成 (tools/new-tool.ts)
2. default-tools.tsに登録
→ 2箇所の変更 (各ツールは独立したファイル)
```

### 問題5: テスタビリティ (Testability)

**現状**:
```typescript
// InteractionLayerのテスト
// ❌ 不可能: ツールロジックがReactコンポーネントに密結合
// ✅ 可能: E2Eテストのみ (遅い、不安定)

// ToolManagerのテスト
// ✅ 可能: XState状態マシンのユニットテスト (高速、安定)
// ✅ 可能: @xstate/test による自動テスト生成
// ❌ 現状: 使用されていないため無意味
```

---

## 🔬 コード品質の比較

### InteractionLayerパターン (現状)

**複雑度**:
- 循環的複雑度: 高 (if/else分岐が多数)
- 行数: 392行 (1ファイル)
- 依存関係: Reactに密結合

**可読性**:
```typescript
// ❌ ツールロジックが散在
handlePointerDown() {
  if (tool === "pan") { /* ... */ }
  else if (tool === "rect") { /* ... */ }
  else if (tool === "draw") { /* ... */ }
}
handlePointerMove() {
  if (tool === "pan") { /* ... */ }
  else if (tool === "rect") { /* ... */ }
  else if (tool === "draw") { /* ... */ }
}
handlePointerUp() {
  if (tool === "pan") { /* ... */ }
  else if (tool === "rect") { /* ... */ }
  else if (tool === "draw") { /* ... */ }
}
```

**保守性**:
- ツール追加時の変更箇所: 6箇所以上
- バグ混入リスク: 高 (既存ツールへの影響)
- リファクタリング難易度: 高

### ToolManagerパターン (設計)

**複雑度**:
- 循環的複雑度: 低 (各ツールは独立した状態マシン)
- 行数: 各ツール50-250行 (ファイル分割)
- 依存関係: Reactから独立

**可読性**:
```typescript
// ✅ ツールロジックが明確
export const panToolMachine = setup({
  actions: {
    startPan: assign({ /* ... */ }),
    updateViewport: ({ /* ... */ }),
    endPan: assign({ /* ... */ }),
  },
}).createMachine({
  states: {
    idle: { on: { POINTER_DOWN: "panning" } },
    panning: { on: { POINTER_MOVE: "updateViewport", POINTER_UP: "idle" } },
  },
});
```

**保守性**:
- ツール追加時の変更箇所: 2箇所 (新規ファイル + 登録)
- バグ混入リスク: 低 (既存ツールへの影響なし)
- リファクタリング難易度: 低

---

## 📊 影響分析

### 現在の実装パターンの継続コスト

| 項目 | コスト | 備考 |
|------|--------|------|
| **新ツール追加時間** | 4-8時間/ツール | InteractionLayerの6箇所を変更 |
| **バグ修正時間** | 2-4時間/バグ | 影響範囲の特定が困難 |
| **テスト追加時間** | 2-4時間/ツール | E2Eテストのみ、遅い |
| **ドキュメント更新** | 1-2時間/ツール | コード散在により困難 |
| **新メンバーのオンボーディング** | 2-3日 | InteractionLayerの理解が必須 |

### ToolManager統合後の期待効果

| 項目 | 改善 | 備考 |
|------|------|------|
| **新ツール追加時間** | 1-2時間/ツール (-75%) | 独立したファイルで完結 |
| **バグ修正時間** | 0.5-1時間/バグ (-75%) | ツール単位で影響範囲が明確 |
| **テスト追加時間** | 0.5-1時間/ツール (-75%) | ユニットテストが可能 |
| **ドキュメント更新** | 0.5時間/ツール (-75%) | コード=ドキュメント |
| **新メンバーのオンボーディング** | 0.5-1日 (-67%) | 状態マシン図で理解可能 |

---

## 🛠️ 解決策の提案

### オプション1: 段階的統合 (推奨)

**Phase 1: 新ツールからToolManager使用** (低リスク)
1. 新しいツール (pan等) をToolManagerで実装
2. InteractionLayerからToolManagerへイベントを転送
3. 両パターンを並行運用

**Phase 2: 既存ツールの移行** (中リスク)
1. rectangle → ToolManager
2. ellipse → ToolManager
3. draw → ToolManager
4. InteractionLayerを薄いラッパーに変更

**Phase 3: 完全移行** (低リスク)
1. InteractionLayerをイベントプロキシのみに
2. ToolManagerが完全にツール処理を担当
3. レガシーコードの削除

**期間**: 3-6週間
**リスク**: 低 (段階的なため、各Phaseでロールバック可能)

### オプション2: 一括リファクタリング (非推奨)

**手順**:
1. InteractionLayerの全ロジックをToolManagerに移行
2. InteractionLayerをイベントプロキシに変更
3. すべてのE2Eテストを実行して検証

**期間**: 2-3週間
**リスク**: 高 (大規模変更のため、回帰バグのリスク)

### オプション3: 現状維持 + ドキュメント整備 (最低限)

**対応**:
1. InteractionLayerのツール処理をコメントで明記
2. 新ツール追加のガイドライン作成
3. ToolManagerの使用を将来的な課題として記録

**期間**: 1週間
**リスク**: なし (変更なし)
**デメリット**: 技術的負債が蓄積

---

## 📝 推奨アクション

### 短期 (1-2週間)

1. **ドキュメント整備**
   - [ ] 本ISSUEを技術的負債として記録
   - [ ] InteractionLayerにツール処理の構造を明記
   - [ ] ToolManager統合のロードマップを作成

2. **新ツールのガイドライン**
   - [ ] 新ツールはToolManagerパターンで実装する方針を決定
   - [ ] panツールをToolManager統合の参考実装とする

### 中期 (1-3ヶ月)

1. **Phase 1実装**
   - [ ] InteractionLayerにToolManagerブリッジを追加
   - [ ] panツールをToolManager経由で動作させる
   - [ ] 既存ツールはInteractionLayerのまま維持

2. **テスト環境整備**
   - [ ] ToolManagerのユニットテスト環境を構築
   - [ ] XState Inspectorの統合

### 長期 (3-6ヶ月)

1. **Phase 2-3実装**
   - [ ] 既存ツール (rectangle, ellipse, draw) をToolManagerに移行
   - [ ] InteractionLayerをイベントプロキシに変更
   - [ ] レガシーコードの削除

2. **パフォーマンス最適化**
   - [ ] ツールマシンの最適化
   - [ ] イベントスロットリング

---

## 📚 参考資料

### 既存ドキュメント

- [XState Tool System Design](./xstate-tool-system-design.md) - ToolManagerの設計書
- [Tool Manager Refactoring Plan](./tool-manager-refactoring-plan.md) - リファクタリング計画
- [Whiteboard Integration Architecture](../architecture/whiteboard-integration-architecture.md) - 統合アーキテクチャ
- [API Documentation](../api/README.md) - ToolManager API

### XState v5リソース

- [XState v5 Documentation](https://stately.ai/docs/xstate)
- [XState v5 Migration Guide](https://stately.ai/docs/migration)
- [XState Inspector](https://stately.ai/docs/inspector)

### コードベース

- **ToolManager実装**: `packages/tools/src/adapters/tool-manager-adapter.ts`
- **XState状態マシン**: `packages/tools/src/tools/*.ts`
- **現在の実装**: `packages/react-canvas/src/components/interaction-layer.tsx`
- **ツール設定**: `packages/tools/src/configs/default-tools.ts`

---

## 🔗 関連Issue

- パンツール実装 (PR #148) - この調査のきっかけ
- ツールシステムリファクタリング (計画中)

---

## 👥 関係者

**作成者**: Claude Code (調査)
**承認者**: (未定)
**実装者**: (未定)

---

## 📌 結論

uSketchのツールシステムは、**優れた設計 (ToolManager/XState) が存在するにも関わらず、実際には使用されていない**という技術的負債を抱えています。

この問題は、以下の観点から優先的に対処すべきです:

1. **保守性**: 新ツール追加のコストが高い
2. **品質**: ユニットテストが困難
3. **スケーラビリティ**: InteractionLayerが肥大化
4. **開発体験**: XStateのツールが活用できない

**推奨される解決策は「段階的統合 (Phase 1-3)」**であり、リスクを最小化しながら、既存の優れた設計を活用できます。
