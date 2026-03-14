# uSketch v2 開発プロジェクト

## プロジェクト概要

uSketch v2は、リアルタイムコラボレーション対応のブラウザベースホワイトボードアプリケーション。
v1の技術的知見を活かしつつ、MVPファーストで再構築する。

## 現在のステータス

🚧 リニューアル準備中。v1コードは削除済み、ドキュメントのみの状態。

## 重要ドキュメント

- `docs/postmortem.md` — v1の振り返り
- `docs/new-product-proposal.md` — v2のプロダクト企画
- `docs/architecture-v2.md` — v2のアーキテクチャ設計
- `docs/v1/` — v1の旧ドキュメント（参考資料）

## ファイル命名規則

すべての `.ts` / `.tsx` ファイルは **kebab-case** で命名する。

## v2 技術スタック（予定）

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

## v2 パッケージ構成（予定）

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

plugins/
  usketch-plugin-tool-select/    — 選択ツール
  usketch-plugin-tool-pan/       — パンツール
  usketch-plugin-shape-rect/     — 矩形（シェイプ+描画ツール）
  usketch-plugin-shape-ellipse/  — 楕円（シェイプ+描画ツール）
  usketch-plugin-shape-freedraw/ — フリーハンド（シェイプ+描画ツール）
  usketch-plugin-shape-text/     — テキスト（シェイプ+テキストツール）
  usketch-plugin-bg-grid/        — グリッド背景
  usketch-plugin-bg-dots/        — ドット背景
  usketch-plugin-snap/           — スナップ・スマートガイド
  usketch-plugin-export/         — PNG/SVG/PDFエクスポート
```
