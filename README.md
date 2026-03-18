# uSketch v2

リアルタイムコラボレーション対応のブラウザベース・ホワイトボードアプリケーション。

プラグインアーキテクチャにより、ツール・シェイプ・背景などすべての機能をプラグインとして実装。

## セットアップ

```bash
# Node.js 22 + pnpm 10 が必要
pnpm install
pnpm dev
```

開発サーバーは http://localhost:4578 で起動します。

## スクリプト

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | 全パッケージのビルド |
| `pnpm test` | テスト実行 |
| `pnpm typecheck` | TypeScript 型チェック |
| `pnpm lint` | Biome によるリント |
| `pnpm format` | Biome によるフォーマット |
| `pnpm clean` | ビルド成果物の削除 |

## プロジェクト構成

```
apps/
  web/                — メイン Web アプリ（React + Vite）
  server/             — API サーバー（Hono）

packages/
  core/               — プラグインシステム・アプリ初期化
  canvas-engine/      — 描画エンジン・ビューポート・座標変換
  store/              — 状態管理・Undo/Redo
  shared/             — 共有型定義・ユーティリティ
  ui/                 — コア UI コンポーネント

plugins/
  usketch-plugin-tool-select/    — 選択ツール（マーキー・マルチ選択・リサイズ）
  usketch-plugin-tool-pan/       — パンツール
  usketch-plugin-shape-rect/     — 矩形
  usketch-plugin-shape-ellipse/  — 楕円
  usketch-plugin-shape-freedraw/ — フリーハンド描画
  usketch-plugin-shape-text/     — テキスト（@zag-js ステートマシン）
  usketch-plugin-shape-counter/  — カウンター
  usketch-plugin-bg-grid/        — グリッド背景
  usketch-plugin-bg-dots/        — ドット背景
  usketch-plugin-snap/           — スナップ・スマートガイド
  usketch-plugin-viewport-nav/   — ビューポートナビゲーション
  usketch-plugin-effect-ripple/  — リプルエフェクト
  usketch-plugin-export/         — PNG/SVG/PDF エクスポート
  usketch-plugin-debug-hud/      — デバッグ HUD（開発用）
```

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 19 / TypeScript 5.8 |
| ビルド | Vite 7 / Turborepo |
| リント・フォーマット | Biome |
| テスト | Vitest |
| パッケージ管理 | pnpm |
| 状態マシン | @zag-js/core（テキスト編集） |
| バックエンド | Hono |

## アーキテクチャ

- **統一プラグイン API** — ツール・シェイプ・背景・機能すべてが `UsketchPlugin` インターフェースを実装
- **レイヤーベース描画** — プラグインがレイヤーを登録し、コアが描画順序を制御
- **コマンドパターン** — Undo/Redo をコマンドオブジェクトで管理
- **イベントバス** — プラグイン間の疎結合な通信
- **Edge-First** — Cloudflare Workers + Durable Objects で低コスト運用（予定）
- **Offline-First** — Yjs（CRDT）によるローカル動作 + オンライン同期（予定）

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [アーキテクチャ設計書](docs/architecture-v2.md) | 技術設計・パッケージ構成・データモデル |
| [プラグインシステム設計書](docs/plugin-system-design.md) | 統一プラグインAPI・レイヤーシステムの詳細 |
| [プロダクト企画書](docs/new-product-proposal.md) | ビジョン・MVPスコープ・ビジネスモデル |
| [ユースケース集](docs/use-cases.md) | 主要ユーザーシナリオとプラグインの動作 |
| [開発ロードマップ](docs/roadmap.md) | Phase 0〜4 の開発計画 |
| [ポストモーテム](docs/postmortem.md) | v1 プロジェクトの振り返り・教訓 |

## 規約

- ファイル名は **kebab-case**（例: `text-editing-machine.ts`）
- コミットメッセージは **gitmoji** を使用（例: `✨ feat:`, `🐛 fix:`）

## ライセンス

ISC
