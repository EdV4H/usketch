# uSketch v2 開発プロジェクト

## プロジェクト概要

uSketch v2は、リアルタイムコラボレーション対応のブラウザベースホワイトボードアプリケーション。
v1の技術的知見を活かしつつ、MVPファーストで再構築する。

## 現在のステータス

🚀 v1.0.0 リリース準備中（コード・ドキュメント完了、main merge + tag 発行待ち）。Cloudflare Workers + Pages 上で main が稼働中。

## 重要ドキュメント

- `docs/postmortem.md` — v1の振り返り
- `docs/new-product-proposal.md` — v2のプロダクト企画
- `docs/architecture-v2.md` — v2のアーキテクチャ設計
- `docs/prd-ai-native.md` — AIネイティブ機能のPRD
- `docs/prd-not-whiteboard.md` — Not Whiteboard（コミュニケーション空間）のPRD
- `docs/plugin-system-design.md` — プラグインシステム設計。**プラグインの UI は必ず HUD に登録する**（独自ツールバー・パネルの実装は禁止）。**操作ロジックは HUD の `set`/`run` クロージャに埋めず、`BoardStore` を受け取る純関数として最初から公開 export し、HUD はそれを呼ぶだけにする**。ホスト向けの型付き API は `defineService`（`@edv4h/usketch-shared`）でサービスとして公開する（参照実装: `usketch-plugin-map` の `map-service.ts` = `getMapApi`）

## ファイル命名規則

すべての `.ts` / `.tsx` ファイルは **kebab-case** で命名する。

## v2 技術スタック

### フロントエンド
- React 19 / TypeScript 5.9+
- XState 5（ツール状態マシン）
- Zustand 5（ローカル状態管理）
- Yjs 13（CRDT同期）
- Zod 4（バリデーション）
- Vite 7

### バックエンド
- Hono（APIフレームワーク）
- Cloudflare Workers / Durable Objects
- Cloudflare D1（SQLite）
- Better Auth（認証）
- Drizzle ORM

### 開発ツール
- Turborepo / pnpm
- Biome（Linter/Formatter）
- Vitest / Playwright
- Lefthook（Git hooks）

## v2 パッケージ構成

```
apps/
  web/            — メインWebアプリ
  server/         — Edge APIサーバー

packages/
  core/           — プラグインAPI、レイヤーシステム
  canvas-engine/  — 描画エンジン + ビューポート + 座標変換
  store/          — 状態管理（Zustand + Yjs）
  ui/             — コアUIコンポーネント
  shared/         — 共有型定義 + ユーティリティ

plugins/        — 50+ plugin (shape / tool / sync / AI / presence / export 等)
```

完全な一覧は `plugins/` ディレクトリと README.md を参照。
