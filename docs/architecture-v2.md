# uSketch v2 アーキテクチャ設計書

**作成日**: 2026-03-14
**ステータス**: 設計段階

---

## 1. 設計原則

前プロジェクトの教訓を踏まえ、以下の原則で設計する。

| 原則 | 説明 | 前プロジェクトの反省 |
|------|------|---------------------|
| **MVP First** | 最小限のパッケージで始め、必要に応じて分割 | 初期から18パッケージは過剰だった |
| **User Value First** | 保存・共有・コラボを最初から組み込む | Phase 4まで保存機能がなかった |
| **Proven Libraries** | CRDT、認証等は実績あるライブラリを採用 | 自前実装を最小限に |
| **Edge-First** | サーバーレス + Edge Runtimeで低コスト運用 | — |
| **Offline-First** | ローカルで動作し、オンライン時に同期 | — |

---

## 2. 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                       クライアント                        │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Canvas   │  │  Tools   │  │  Store   │  │  Sync   │ │
│  │  Engine   │  │  System  │  │ (Zustand)│  │  (Yjs)  │ │
│  │          │  │ (XState) │  │          │  │         │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │             │             │              │      │
│       └─────────────┴──────┬──────┴──────────────┘      │
│                            │                            │
│                    ┌───────┴───────┐                    │
│                    │   React App   │                    │
│                    └───────┬───────┘                    │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │    WebSocket    │
                    └────────┬────────┘
                             │
┌────────────────────────────┼────────────────────────────┐
│                       Edge Runtime                       │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Durable    │  │     Auth     │  │     API       │ │
│  │   Objects    │  │   (Better    │  │   (Hono)      │ │
│  │  (Yjs Sync)  │  │    Auth)     │  │               │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                 │                   │         │
│         └─────────────────┴─────────┬─────────┘         │
│                                     │                   │
│                            ┌────────┴────────┐          │
│                            │  Cloudflare D1  │          │
│                            │   (SQLite)      │          │
│                            └─────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. パッケージ構成

**レイヤーベースアーキテクチャ + 統一プラグインシステム** を採用。
コア（薄いフレームワーク） + プラグイン（機能の実体）という構造で、全ての描画機能をプラグインとして提供する。

```
usketch-v2/
├── apps/
│   ├── web/                          # メインWebアプリ（React + Vite）
│   └── server/                       # Edge APIサーバー（Hono + Cloudflare Workers）
│
├── packages/
│   ├── core/                         # コアフレームワーク（プラグインAPI、レイヤーシステム）
│   ├── canvas-engine/                # 描画エンジン + ビューポート + 座標変換
│   ├── store/                        # 状態管理（Zustand + Yjs統合）
│   ├── ui/                           # コアUIコンポーネント（ツールバー、パネル等のフレーム）
│   └── shared/                       # 共有型定義 + ユーティリティ
│
├── plugins/
│   ├── usketch-plugin-tool-select/   # 選択・移動・リサイズツール
│   ├── usketch-plugin-tool-pan/      # パン（Hand）ツール
│   ├── usketch-plugin-shape-rect/    # 矩形シェイプ + 矩形描画ツール
│   ├── usketch-plugin-shape-ellipse/ # 楕円シェイプ + 楕円描画ツール
│   ├── usketch-plugin-shape-freedraw/# フリーハンドシェイプ + 描画ツール
│   ├── usketch-plugin-shape-text/    # テキストシェイプ + テキストツール
│   ├── usketch-plugin-bg-grid/       # グリッド背景
│   ├── usketch-plugin-bg-dots/       # ドット背景
│   ├── usketch-plugin-snap/          # スナップ・スマートガイド機能
│   └── usketch-plugin-export/        # PNG/SVG/PDFエクスポート
│
├── turbo.json
├── package.json
└── biome.json
```

### 設計思想

- **コア（packages/）**: プラグインの登録・実行・レイヤー管理を担う薄いフレームワーク
- **プラグイン（plugins/）**: 全ての具体的な機能はプラグインとして実装
- **shapeプラグイン**: シェイプ定義とそれを作成するツールを1つのプラグインにバンドル
- **toolプラグイン**: シェイプを持たない汎用ツール（選択、パン等）
- **bgプラグイン**: 背景レンダリング
- **機能プラグイン**: スナップ、エクスポート等の横断的機能

### v1との対応

| v2 | v1（統合元） |
|----|------------|
| `core` | 新規（プラグインフレームワーク） |
| `canvas-engine` | `react-canvas` + `coordinate-system` |
| `store` | `store` + Yjs同期レイヤー |
| `usketch-plugin-shape-rect` | `shape-plugins/rectangle` + `react-shapes/rectangle` + `tools/rectangle-tool` |
| `usketch-plugin-tool-select` | `tools/select-tool` |
| `usketch-plugin-bg-*` | `background-presets` |
| `usketch-plugin-snap` | `tools/utils/snap-engine` + `tools/utils/quad-tree` |
| **削除** | `shape-abstraction`, `effect-registry`, `input-manager`, `e2e-tests`, `test-utils` |

---

## 4. 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| React | 19.x | UIフレームワーク | 前プロジェクトの資産活用、エコシステム |
| TypeScript | 5.9+ | 型安全性 | 必須 |
| XState | 5.x | ツール状態マシン | 前プロジェクトで実証済み |
| Zustand | 5.x | ローカル状態管理 | 軽量、前プロジェクトで実証済み |
| Yjs | 13.x | CRDT同期 | リアルタイムコラボの業界標準 |
| Vite | 7.x | ビルド | 高速、前プロジェクトで実証済み |
| Zod | 4.x | バリデーション | 前プロジェクトで実証済み |

### バックエンド

| 技術 | 用途 | 選定理由 |
|------|------|----------|
| Hono | APIフレームワーク | Edge Runtime対応、軽量、型安全 |
| Cloudflare Workers | Edge Runtime | 低レイテンシ、低コスト |
| Cloudflare Durable Objects | WebSocket + Yjs同期 | ステートフルEdge、Yjsとの相性 |
| Cloudflare D1 | データベース（SQLite） | Edge対応、低コスト |
| Better Auth | 認証 | OSSで自前ホスト可能、Edge対応 |
| Drizzle ORM | DB操作 | 型安全、D1対応 |

### 開発ツール

| 技術 | 用途 |
|------|------|
| Turborepo | モノレポビルド |
| Biome | Linter / Formatter |
| Vitest | ユニットテスト |
| Playwright | E2Eテスト |
| Lefthook | Git hooks |
| pnpm | パッケージ管理 |

---

## 5. コアモジュール設計

### 5.1 プラグインフレームワーク（core）

全プラグイン種別に統一的なインターフェースを提供する。詳細は [プラグインシステム設計書](./plugin-system-design.md) を参照。

```typescript
// core/src/index.ts
export { PluginRegistry } from './plugin-registry'
export { LayerManager } from './layer-manager'
export { TransientRegistry } from './transient-registry'
export { createApp } from './app'
export type {
  UsketchPlugin, ToolPlugin, ShapePlugin, BackgroundPlugin, FeaturePlugin,
  TransientObject, TransientRenderer,
} from './types'
```

**コアの責務**:
- プラグインの登録・ライフサイクル管理
- レイヤーの `order` 順描画
- 一時オブジェクト（Transient）の管理・Yjs Awareness同期・TTL自動消滅
- カーソル・プレゼンスの基本実装

### 5.2 描画エンジン（canvas-engine）

前プロジェクトの `react-canvas` + `coordinate-system` を統合。

```typescript
// canvas-engine/src/index.ts
export { Canvas } from './components/canvas'
export { useCanvas } from './hooks/use-canvas'
export { CoordinateTransformer } from './coordinate-transformer'
export { Viewport } from './viewport'
```

**設計方針**:
- React コンポーネント（`<Canvas />`）として提供
- DOM レンダリング（SVG/HTML要素）を基本とし、パフォーマンスが必要な部分のみ Canvas2D にフォールバック
- ビューポート管理（パン、ズーム）を内蔵
- レイヤーシステムと連携し、プラグインが登録したレイヤーを適切な順序で描画

### 5.3 状態管理 + 同期（store）

Zustand + Yjs を統合した状態管理レイヤー。

```
┌──────────────────────────────┐
│         React Components      │
│              │                │
│         useStore()            │
│              │                │
│  ┌───────────┴───────────┐   │
│  │    Zustand Store      │   │
│  │    (ローカル状態)       │   │
│  └───────────┬───────────┘   │
│              │                │
│  ┌───────────┴───────────┐   │
│  │    Yjs Document       │   │
│  │    (CRDT同期)          │   │
│  └───────────┬───────────┘   │
│              │                │
│  ┌───────────┴───────────┐   │
│  │   Sync Provider       │   │
│  │   (WebSocket/         │   │
│  │    IndexedDB)         │   │
│  └───────────────────────┘   │
└──────────────────────────────┘
```

```typescript
// store/src/index.ts
export { createBoardStore } from './board-store'
export { useBoardStore } from './hooks'
export { SyncProvider } from './sync/provider'

// Yjs Document がシェイプデータの正本
// Zustand はUIステート（選択中のシェイプ、ツール、パン位置等）を管理
// Yjs の変更を Zustand に反映する同期レイヤーを提供
```

**同期フロー**:
```
ユーザー操作 → Zustand → Yjs Doc → WebSocket → Durable Object → 他クライアント
                                   → IndexedDB（ローカル永続化）
```

### 5.5 リアルタイム同期の詳細

```typescript
// server/src/board-room.ts（Durable Object）
export class BoardRoom extends DurableObject {
  private yjsDoc: Y.Doc
  private connections: Map<string, WebSocket>

  async fetch(request: Request): Promise<Response> {
    // WebSocket接続のハンドシェイク
    // Yjs update messagesの中継
    // プレゼンス情報のブロードキャスト
  }
}
```

**プレゼンス情報**:
```typescript
interface Presence {
  id: string
  name: string
  color: string       // ユーザー固有の色
  cursor: Point | null
  selectedShapeIds: string[]
}
```

---

## 6. データモデル

### 6.1 ボードデータ（Yjs Document）

```typescript
// Yjs Docの構造
interface BoardDocument {
  shapes: Y.Map<ShapeData>       // シェイプデータ（CRDT Map）
  layers: Y.Array<string>         // レイヤー順序（CRDT Array）
  metadata: Y.Map<unknown>        // ボード名、背景設定等
}

// 個別のシェイプデータ
interface ShapeData {
  id: string
  type: 'rectangle' | 'ellipse' | 'freedraw' | 'text'
  x: number
  y: number
  width: number
  height: number
  style: ShapeStyle
  // 型別の追加データ
  [key: string]: unknown
}

interface ShapeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
}
```

### 6.2 サーバーサイドデータ（D1）

```sql
-- ボード管理
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_public INTEGER NOT NULL DEFAULT 0
);

-- アクセス制御
CREATE TABLE board_members (
  board_id TEXT NOT NULL REFERENCES boards(id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner' | 'editor' | 'viewer'
  PRIMARY KEY (board_id, user_id)
);

-- ユーザー（Better Authが管理、参照用）
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT
);
```

---

## 7. API設計

### 7.1 REST API（Hono）

```
# ボード管理
POST   /api/boards              # ボード作成
GET    /api/boards              # ボード一覧
GET    /api/boards/:id          # ボード取得
PATCH  /api/boards/:id          # ボード更新（タイトル等）
DELETE /api/boards/:id          # ボード削除

# 共有
POST   /api/boards/:id/share    # 共有リンク生成
GET    /api/boards/:id/members  # メンバー一覧
POST   /api/boards/:id/members  # メンバー追加
DELETE /api/boards/:id/members/:userId  # メンバー削除

# エクスポート
GET    /api/boards/:id/export?format=png|svg|pdf

# 認証（Better Auth）
POST   /api/auth/*              # Better Auth routes
```

### 7.2 WebSocket（Durable Objects）

```
# リアルタイム同期
WS /api/boards/:id/ws

# メッセージプロトコル
→ { type: "yjs-update", data: Uint8Array }     # Yjs差分更新
→ { type: "presence", data: Presence }          # プレゼンス更新
← { type: "yjs-update", data: Uint8Array }     # 他クライアントの更新
← { type: "presence", data: Presence[] }        # 全員のプレゼンス
```

---

## 8. オフライン対応

```
┌────────────┐      ┌────────────┐      ┌────────────┐
│   Yjs Doc  │ ──── │ IndexedDB  │      │   Server   │
│  (メモリ)   │      │ (ローカル)  │      │  (D.O.)    │
└──────┬─────┘      └────────────┘      └──────┬─────┘
       │                                       │
       │   オンライン時: WebSocket同期           │
       ├───────────────────────────────────────┤
       │                                       │
       │   オフライン時: ローカルのみ更新          │
       │   → オンライン復帰時に自動同期           │
       └───────────────────────────────────────┘
```

- **Yjs** + **y-indexeddb** でローカル永続化
- オフラインで編集した内容は、オンライン復帰時にCRDTマージで自動同期
- 競合解決はYjsのCRDTが自動処理

---

## 9. エクスポート機能

```typescript
// canvas-engine/src/export.ts
export async function exportBoard(
  doc: Y.Doc,
  format: 'png' | 'svg' | 'pdf',
  options?: ExportOptions
): Promise<Blob> {
  switch (format) {
    case 'svg':
      return exportAsSVG(doc)      // DOM → SVG変換
    case 'png':
      return exportAsPNG(doc)      // SVG → Canvas → PNG
    case 'pdf':
      return exportAsPDF(doc)      // SVG → PDF（pdf-lib）
  }
}
```

---

## 10. セキュリティ

| 項目 | 対策 |
|------|------|
| 認証 | Better Auth（セッションベース） |
| 認可 | ボード単位のRBAC（owner/editor/viewer） |
| WebSocket | 認証トークン検証後にアップグレード |
| XSS | React のデフォルトエスケーピング + CSP |
| CSRF | SameSite Cookie + Origin検証 |
| レート制限 | Cloudflare WAF + カスタムレートリミッター |

---

## 11. パフォーマンス戦略

| 対象 | 戦略 |
|------|------|
| 描画 | DOM要素の仮想化（ビューポート外は非レンダリング） |
| Yjs同期 | 差分更新のバッチング（16msごと） |
| ネットワーク | Edge Runtime（ユーザー近接サーバー） |
| バンドル | コード分割、動的インポート（ツール/形状プラグイン） |
| アセット | Cloudflare CDNでの静的アセット配信 |

---

## 12. テスト戦略

| レベル | ツール | 対象 |
|--------|--------|------|
| ユニット | Vitest | ツールロジック、形状計算、座標変換 |
| コンポーネント | Vitest + Testing Library | React コンポーネント |
| 統合 | Vitest | Yjs同期、Store連携 |
| E2E | Playwright | ユーザーシナリオ（描画、コラボ、エクスポート） |

**前プロジェクトからの教訓**:
- E2Eテストの安定性を最優先（フレーキーテストは即修正）
- CIタイムアウトは十分に取る
- テストはパッケージに同梱（別パッケージに分けない）

---

## 13. デプロイ

```
GitHub Push → GitHub Actions
  ├── Lint + Type Check + Unit Test
  ├── Build
  ├── E2E Test（Playwright）
  └── Deploy
       ├── apps/web    → Cloudflare Pages
       └── apps/server → Cloudflare Workers
```

**環境**:
| 環境 | 用途 | デプロイトリガー |
|------|------|-----------------|
| Preview | PR単位の確認 | PR作成/更新 |
| Staging | リリース前検証 | `main` ブランチ |
| Production | 本番 | Git tag / 手動承認 |

---

## 14. まとめ

v2アーキテクチャの核心は:

1. **統一プラグインアーキテクチャ**: ツール・シェイプ・背景・機能を全て同じプラグインAPIで管理
2. **レイヤーベース描画**: プラグインがレイヤーを登録し、コアが描画順序を制御
3. **Yjs統合**: 保存とコラボレーションをアーキテクチャレベルで組み込む
4. **Edge-First**: Cloudflareスタックで低コスト・低レイテンシ
5. **前プロジェクトの強みを活かす**: XStateツールシステム、形状プラグイン、座標変換は移植
6. **前プロジェクトの失敗を繰り返さない**: MVP → ユーザーフィードバック → 拡張のサイクルを守る

## 関連ドキュメント

- [プラグインシステム設計書](./plugin-system-design.md) — 統一プラグインAPI、レイヤーシステムの詳細
- [ユースケース集](./use-cases.md) — 主要なユーザーシナリオと対応するプラグインの動作
