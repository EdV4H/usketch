# Zod スキーマ導入検討書

## 概要

uSketchプロジェクトにおけるZodライブラリの導入可能性について検討します。Zodは実行時の型検証とTypeScript型の自動生成を提供するスキーマ宣言・検証ライブラリです。

## 現状分析

### 現在の型定義の状況

1. **TypeScriptインターフェースのみ使用**
   - `@usketch/shared-types`で型定義を管理
   - 実行時の型検証は未実装
   - 外部データの入力検証なし

2. **型定義の主要カテゴリ**
   - **Shape型**: BaseShape, RectangleShape, EllipseShape, LineShape, TextShape, FreedrawShape
   - **状態管理型**: WhiteboardState, Camera, Point
   - **ツール設定型**: ToolConfig, ToolManagerOptions（計画中）

3. **外部データとのやり取り**
   - 現時点では外部APIとの通信なし
   - LocalStorageの利用なし
   - ファイルの保存/読み込み機能は未実装

## Zod導入の適用候補

### 1. **Shape型のバリデーション** ⭐⭐⭐⭐⭐
```typescript
import { z } from 'zod';

// 基本Shapeスキーマ
const BaseShapeSchema = z.object({
  id: z.string(),
  type: z.enum(['rectangle', 'ellipse', 'line', 'text', 'freedraw']),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  strokeColor: z.string().regex(/^#[0-9A-F]{6}$/i).default('#000000'),
  fillColor: z.string().regex(/^#[0-9A-F]{6}$/i).default('#ffffff'),
  strokeWidth: z.number().positive().default(1),
});

// Rectangle Shape
const RectangleShapeSchema = BaseShapeSchema.extend({
  type: z.literal('rectangle'),
  width: z.number().positive(),
  height: z.number().positive(),
});

// 型の自動生成
type RectangleShape = z.infer<typeof RectangleShapeSchema>;
```

**メリット**:
- 外部からのデータ読み込み時の安全性向上
- デフォルト値の管理が容易
- バリデーションルールの一元管理

### 2. **ToolConfig検証** ⭐⭐⭐⭐
```typescript
const ToolConfigSchema = z.object({
  id: z.string().min(1),
  machine: z.any(), // XState Machineの型
  displayName: z.string().optional(),
  icon: z.string().optional(),
  shortcut: z.string().max(1).optional(),
  enabled: z.boolean().default(true),
});

const ToolManagerOptionsSchema = z.object({
  tools: z.array(ToolConfigSchema).min(1),
  defaultToolId: z.string().optional(),
  onToolChange: z.function().args(z.string()).returns(z.void()).optional(),
});
```

**メリット**:
- プラグインツールの安全な読み込み
- 設定ファイルの検証
- 動的ツール追加時の安全性

### 3. **イベントデータの検証** ⭐⭐⭐
```typescript
const PointerEventSchema = z.object({
  type: z.enum(['POINTER_DOWN', 'POINTER_MOVE', 'POINTER_UP']),
  point: z.object({
    x: z.number(),
    y: z.number(),
  }),
  shiftKey: z.boolean().optional(),
  ctrlKey: z.boolean().optional(),
  metaKey: z.boolean().optional(),
});
```

**メリット**:
- イベントハンドラーの安全性向上
- 不正なイベントデータの早期検出

### 4. **保存/読み込み機能（将来）** ⭐⭐⭐⭐⭐
```typescript
const SaveFileSchema = z.object({
  version: z.string(),
  shapes: z.record(ShapeSchema),
  camera: CameraSchema,
  metadata: z.object({
    createdAt: z.string().datetime(),
    modifiedAt: z.string().datetime(),
    author: z.string().optional(),
  }),
});

// ファイル読み込み時の使用例
function loadWhiteboardFile(data: unknown) {
  const result = SaveFileSchema.safeParse(data);
  if (!result.success) {
    console.error('Invalid file format:', result.error);
    throw new Error('ファイルフォーマットが不正です');
  }
  return result.data;
}
```

## 導入計画

### フェーズ1: 基盤整備（推奨）
1. `@usketch/shared-types`にZodを追加
2. 既存の型定義をZodスキーマに移行
3. TypeScript型は`z.infer`で自動生成

### フェーズ2: 段階的適用
1. 新機能（ToolManager リファクタリング）から適用
2. 外部データとのやり取りがある部分を優先
3. 既存コードは段階的に移行

### フェーズ3: 完全移行
1. すべての型定義をZodスキーマに統一
2. バリデーション関数の共通化
3. エラーハンドリングの標準化

## 比較検討

### Zodを使う場合

**メリット**:
- ✅ 実行時の型安全性
- ✅ TypeScript型の自動生成
- ✅ 詳細なエラーメッセージ
- ✅ スキーマの合成・拡張が容易
- ✅ デフォルト値・変換処理の組み込み
- ✅ 軽量（約8KB gzipped）

**デメリット**:
- ❌ 追加の依存関係
- ❌ 学習コスト
- ❌ ビルドサイズの増加

### 他の選択肢

| ライブラリ | サイズ | 特徴 | 適合度 |
|-----------|--------|------|--------|
| **Zod** | 8KB | TypeScript First、開発体験良好 | ⭐⭐⭐⭐⭐ |
| **Yup** | 15KB | 広く使われている、機能豊富 | ⭐⭐⭐ |
| **io-ts** | 10KB | 関数型プログラミング指向 | ⭐⭐ |
| **手動実装** | 0KB | 依存関係なし、柔軟 | ⭐⭐ |

## 推奨事項

### 導入を推奨する理由

1. **将来の拡張性**
   - ファイル保存/読み込み機能の実装時に必須
   - プラグインシステムの安全性確保
   - リアルタイムコラボレーション機能への対応

2. **開発効率の向上**
   - 型定義とバリデーションの一元管理
   - より良いエラーメッセージ
   - テストの簡素化

3. **ユーザー体験の向上**
   - 不正なデータによるクラッシュを防止
   - わかりやすいエラーメッセージ
   - データマイグレーションの容易化

### 実装例

```typescript
// packages/shared-types/src/schemas/shape.ts
import { z } from 'zod';

// ポイントスキーマ
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// カメラスキーマ
export const CameraSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive().default(1),
});

// Shape関連のスキーマ（省略）

// 型のエクスポート
export type Point = z.infer<typeof PointSchema>;
export type Camera = z.infer<typeof CameraSchema>;

// バリデーション関数のエクスポート
export const validateShape = (data: unknown) => ShapeSchema.safeParse(data);
export const validateCamera = (data: unknown) => CameraSchema.safeParse(data);
```

```typescript
// 使用例: packages/store/src/store.ts
import { validateShape } from '@usketch/shared-types/schemas';

export const whiteboardStore = createStore<WhiteboardStore>((set) => ({
  // ...
  
  addShape: (shape: unknown) => {
    const result = validateShape(shape);
    if (!result.success) {
      console.error('Invalid shape:', result.error);
      return;
    }
    
    set((state) => ({
      ...state,
      shapes: { ...state.shapes, [result.data.id]: result.data },
    }));
  },
  
  // ...
}));
```

## 結論

**Zodの導入を推奨します。**

特に以下の場面で価値を発揮します：

1. **即座に適用すべき箇所**
   - ToolManagerのリファクタリング（新規実装）
   - 将来のファイル保存/読み込み機能

2. **段階的に適用すべき箇所**
   - Shape型の検証
   - イベントデータの検証
   - Store操作の検証

3. **導入タイミング**
   - ToolManagerリファクタリングと同時に開始
   - 新機能から順次適用
   - 既存コードは必要に応じて移行

バンドルサイズへの影響は最小限（8KB）であり、得られる型安全性とDXの向上を考慮すると、導入のメリットが大きく上回ります。