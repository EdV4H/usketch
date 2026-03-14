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

前プロジェクトの18パッケージから**8パッケージ**に統合。

```
usketch-v2/
├── apps/
│   ├── web/                      # メインWebアプリ（React + Vite）
│   └── server/                   # Edge APIサーバー（Hono + Cloudflare Workers）
│
├── packages/
│   ├── canvas-engine/            # 描画エンジン（旧: react-canvas + coordinate-system）
│   ├── tools/                    # ツールシステム（XState状態マシン）
│   ├── shapes/                   # 形状定義 + レジストリ（旧: shape-registry + shape-plugins + react-shapes 統合）
│   ├── store/                    # 状態管理（Zustand + Yjs統合）
│   ├── ui/                       # UIコンポーネント（旧: ui-components + background-presets 統合）
│   └── shared/                   # 共有型定義 + ユーティリティ（旧: shared-types + shared-utils 統合）
│
├── turbo.json
├── package.json
└── biome.json
```

### パッケージ統合マッピング

| v2パッケージ | v1パッケージ（統合元） |
|-------------|----------------------|
| `canvas-engine` | `react-canvas` + `coordinate-system` |
| `tools` | `tools`（そのまま） |
| `shapes` | `shape-registry` + `shape-plugins` + `react-shapes` |
| `store` | `store` + Yjs同期レイヤー追加 |
| `ui` | `ui-components` + `background-presets` |
| `shared` | `shared-types` + `shared-utils` |
| **削除** | `shape-abstraction`（deprecated）、`effect-registry`、`input-manager`、`e2e-tests`、`test-utils` |

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

### 5.1 描画エンジン（canvas-engine）

前プロジェクトの `react-canvas` + `coordinate-system` を統合。

```typescript
// canvas-engine/src/index.ts
export { Canvas } from './components/canvas'
export { useCanvas } from './hooks/use-canvas'
export { CoordinateTransformer } from './coordinate-transformer'
export { Viewport } from './viewport'

// 座標変換は内部モジュールとして統合
// 外部には useCanvas フック経由でAPIを提供
```

**設計方針**:
- React コンポーネント（`<Canvas />`）として提供
- DOM レンダリング（SVG/HTML要素）を基本とし、パフォーマンスが必要な部分のみ Canvas2D にフォールバック
- ビューポート管理（パン、ズーム）を内蔵

### 5.2 ツールシステム（tools）

前プロジェクトからほぼそのまま移植。XState状態マシンが安定していたため。

```typescript
// tools/src/index.ts
export { createSelectTool } from './select-tool'
export { createDrawTool } from './draw-tool'
export { createPanTool } from './pan-tool'
export { createTextTool } from './text-tool'  // 新規
export { createToolManager } from './tool-manager'

// Zodスキーマによる設定検証を維持
```

**変更点（v1 → v2）**:
- Crop/Effectツールは削除（MVP外）
- テキストツールを新規追加
- ツール切り替えのショートカット定義を簡素化

### 5.3 形状システム（shapes）

v1の3パッケージを1パッケージに統合。

```typescript
// shapes/src/index.ts
export { ShapeRegistry } from './registry'
export { rectanglePlugin, ellipsePlugin, freedrawPlugin, textPlugin } from './plugins'
export { ShapeRenderer } from './renderer'

// プラグインは純関数のまま維持（v1の良い設計を踏襲）
```

**形状プラグインのインターフェース**:
```typescript
interface ShapePlugin<T extends ShapeData = ShapeData> {
  type: string
  schema: z.ZodType<T>
  render: (data: T) => React.ReactElement
  getBounds: (data: T) => BoundingBox
  hitTest: (data: T, point: Point) => boolean
  resize: (data: T, handle: ResizeHandle, delta: Point) => T
}
```

### 5.4 状態管理 + 同期（store）

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

1. **パッケージの簡素化**: 18 → 8。必要になったら分割する
2. **Yjs統合**: 保存とコラボレーションをアーキテクチャレベルで組み込む
3. **Edge-First**: Cloudflareスタックで低コスト・低レイテンシ
4. **前プロジェクトの強みを活かす**: XStateツールシステム、形状プラグイン、座標変換は移植
5. **前プロジェクトの失敗を繰り返さない**: MVP → ユーザーフィードバック → 拡張のサイクルを守る
