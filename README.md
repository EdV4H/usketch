# uSketch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./CHANGELOG.md)

リアルタイムコラボレーション対応のブラウザベース・ホワイトボードアプリケーション。

すべての機能（ツール・シェイプ・背景・AI・プレゼン等）を統一プラグイン API で実装する、拡張可能なアーキテクチャが特徴。

## Quick start

```bash
# Node.js 22 + pnpm 10 が必要
pnpm install
pnpm dev
```

開発サーバー: http://localhost:4578

## スクリプト

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | 全パッケージのビルド |
| `pnpm test` | 単体テスト実行（Vitest） |
| `pnpm test:e2e` | E2E テスト（Playwright） |
| `pnpm typecheck` | TypeScript 型チェック |
| `pnpm lint` | Biome リント |
| `pnpm format` | Biome フォーマット |
| `pnpm clean` | ビルド成果物の削除 |
| `pnpm changeset` | リリース用 changeset 作成 |

## 主な機能

### 描画・編集
- **Shape plugins**: rect, ellipse, text, sticky, freedraw, image, frame, connector, group, island, portal, counter, wireframe, community-region, board-portal
- **Tool plugins**: select（XState 駆動の移動・リサイズ・回転）, pan
- **Background**: grid, dots
- **Snap & smart guides**、キーボードショートカット、Undo/Redo（コマンドパターン）

### コラボレーション
- **Realtime sync**: Cloudflare Durable Objects + Yjs WebSocket（awareness 付き）
- **Offline-first**: y-indexeddb によるローカル永続化、再接続時の自動同期
- **Presence**: ライブカーソル、拡張アバター、follow-me、spatial chat、reactions、whistle
- **Link sharing**: 公開 / 限定公開 + role 管理（owner / editor / viewer）

### AI ネイティブ
- **Copilot**: ghost shape によるリアルタイム提案
- **Chat / Voice / Image**: LLM ブリッジ経由の NL2Canvas
- **Smart actions**: 選択シェイプに対するコンテキストメニュー

### プレゼンテーション
- **Frame ベースのスライド** + edit / present モード
- Canvas が stage 矩形に縮退する "Canvas flavor" 設計
- スライドサムネイル（minimap 連動）

### エクスポート
- PNG / SVG / JSON（Satori + Canvas）

## プロジェクト構成

```
apps/
  web/         — メイン Web アプリ（React 19 + Vite 7）
  server/      — Edge API サーバー（Hono + Cloudflare Workers）
  docs/        — ドキュメントサイト（Astro Starlight）
  mcp-server/  — MCP サーバー（Claude Code 連携）

packages/
  core/           — plugin API / レイヤーシステム / TransientRegistry
  canvas-engine/  — ビューポート / 座標変換 / minimap
  store/          — Zustand ベースのボードストア
  sync/           — WebSocket provider（awareness + 再接続）
  shared/         — 共有型 / shape data model / utilities
  ui/             — 共通 UI コンポーネント
  dom-renderer/ / gpu-renderer/ — 2 系統の描画バックエンド
  server-core/    — サーバープラグイン基盤

plugins/
  50+ plugin（詳細は docs/ を参照）
```

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 19 / TypeScript 5.9 |
| ビルド | Vite 7 / Turborepo / pnpm |
| リント | Biome |
| テスト | Vitest / Playwright |
| 状態マシン | XState 5 / @zag-js/core |
| CRDT | Yjs 13 / y-indexeddb |
| バックエンド | Hono / Cloudflare Workers / Durable Objects / D1 |
| 認証 | Better Auth |
| バージョニング | Changesets |

## アーキテクチャ

- **統一プラグイン API** — すべての機能が `UsketchPlugin` インターフェース
- **レイヤーベース描画** — plugin がレイヤーを登録、コアが描画順を制御
- **コマンドパターン** — Undo/Redo
- **イベントバス** — plugin 間の疎結合通信
- **Edge-First** — Cloudflare Workers + Durable Objects で低コスト運用
- **Offline-First** — Yjs CRDT でローカル動作 + オンライン同期

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [CHANGELOG](./CHANGELOG.md) | リリース履歴 |
| [アーキテクチャ設計書](docs/architecture-v2.md) | 技術設計・パッケージ構成・データモデル |
| [プラグインシステム設計書](docs/plugin-system-design.md) | 統一プラグイン API の詳細 |
| [プロダクト企画書](docs/new-product-proposal.md) | ビジョン・MVP スコープ・ビジネスモデル |
| [ユースケース集](docs/use-cases.md) | 主要ユーザーシナリオ |
| [開発ロードマップ](docs/roadmap.md) | Phase 0〜4 の開発計画と実績 |
| [ポストモーテム](docs/postmortem.md) | v1 プロジェクトの振り返り |

## コントリビューション

### ファイル命名規則
すべての `.ts` / `.tsx` ファイルは **kebab-case**（例: `text-editing-machine.ts`）

### コミットメッセージ
**gitmoji** を使用（例: `✨ feat:`, `🐛 fix:`, `♻️ refactor:`）

### リリース
変更を加えたら changeset を作成:

```bash
pnpm changeset
```

## セキュリティ

脆弱性を発見した場合は [SECURITY.md](./SECURITY.md) の手順に従って報告してください。

## ライセンス

[MIT](./LICENSE)
