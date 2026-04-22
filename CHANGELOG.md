# Changelog

このプロジェクト全体のリリース履歴。個別パッケージの詳細は各 `packages/*/CHANGELOG.md` / `plugins/*/CHANGELOG.md` を参照。

## [1.0.0] — 2026-04-22

🎉 **Initial stable release.**

uSketch v2 の最初の安定版。2026-03 の renewal から約 2 ヶ月で MVP 完了基準をすべて満たし、Cloudflare Workers + Pages 上で稼働する状態に到達した。

### Added — Core runtime

- **`@edv4h/usketch-core`** — plugin API、レイヤーシステム、TransientRegistry
- **`@edv4h/usketch-canvas-engine`** — ビューポート、座標変換、minimap
- **`@edv4h/usketch-store`** — Zustand ベースのボードストア
- **`@edv4h/usketch-shared`** — 共有型 / ユーティリティ / shape data model
- **`@edv4h/usketch-sync`** — WebSocket provider（awareness + 再接続）
- **`@edv4h/usketch-dom-renderer`**, **`@edv4h/usketch-gpu-renderer`** — 2 系統の描画バックエンド
- **`@edv4h/usketch-ui`** — 共通 UI コンポーネント

### Added — Shape plugins

`shape-basic` / `shape-text` / `shape-sticky` / `shape-freedraw` / `shape-frame` / `shape-connector` / `shape-image` / `shape-group` / `shape-island` / `shape-board-portal` / `shape-community-region` / `shape-counter` / `shape-wireframe` の 13 種。

### Added — Tool plugins

`tool-select`（XState で移動・リサイズ・回転）、`tool-pan`。

### Added — Background / rendering plugins

`bg-grid`, `bg-dots`, `canvas-filter`, `viewport-nav`, `debug-hud`.

### Added — Realtime & presence plugins

`sync-localstorage-yjs`（IndexedDB 永続化）、`presence-cursor`、`presence-enhanced`、`follow-me`、`spotlight`、`laser`、`reactions`、`effect-ripple`、`avatar`、`whistle`、`spatial-chat`、`community-chat`。

### Added — Productivity plugins

`export`（PNG / SVG / JSON）、`snap`（スナップ・スマートガイド）、`keyboard-shortcuts`、`side-panel`、`comments`、`activity-feed`、`voting`、`board-info-panel`、`presentation`（Frame ベースのスライド + edit/present モード）。

### Added — AI plugins

`ai-agent`（LLM ブリッジ）、`ai-chat`（チャット UI）、`ai-copilot`（ghost shape 提案）、`ai-actions`（コンテキストメニュー）、`ai-voice`、`ai-image`、`ai-recognize`。

### Added — Server plugins

`server-core`、`server-auth`（Better Auth）、`server-boards`（CRUD + share）、`server-chat`、`server-comments`、`server-ai`。

### Infrastructure

- Cloudflare **Workers + Durable Objects** による WebSocket / Yjs sync
- Cloudflare **D1** (SQLite) + Drizzle ORM
- Cloudflare **Pages** によるフロントエンド配信
- Hono ベースの Edge API サーバー
- CI: lint / typecheck / test / build / e2e / deploy が GitHub Actions で自動化
- ドキュメントサイト: Astro Starlight (`apps/docs`)

### Known limitations（1.1.0 以降で対応）

- エラートラッキング（Sentry）未導入
- 構造化ログ（Pino 等）未導入 — `apps/server` は `console.error` ベース
- Privacy policy / Terms of service 未整備
- apps/server の単体テスト薄め
- 既知バグ: [#551 monorepo HMR](https://github.com/EdV4H/usketch/issues/551), [#537 GPU/DOM z-order](https://github.com/EdV4H/usketch/issues/537), [#510 AI Copilot 座標変換](https://github.com/EdV4H/usketch/issues/510), [#499 Renovate ビルドエラー](https://github.com/EdV4H/usketch/issues/499)

### Scope out

- `apps/*`（web / server / docs / mcp-server）は内部アプリのため versioning 対象外（`0.0.0` 据え置き）

---

## Pre-1.0.0

v1.0.0 以前は `0.0.0` 扱いで内部開発中。
