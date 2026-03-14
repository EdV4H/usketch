# uSketch v2 開発ロードマップ

**作成日**: 2026-03-14
**最終更新**: 2026-03-14

---

## フェーズ概要

| Phase | 名称 | 期間 | ゴール |
|-------|------|------|--------|
| 0 | プロジェクト基盤 | 1週間 | モノレポ・CI・開発環境の構築 |
| 1 | MVP | 8週間 | 描画・保存・コラボの最小プロダクト |
| 2 | 成長 | 4週間 | フィードバック対応・機能拡充 |
| 3 | 収益化 | 4週間 | 課金・チーム管理 |
| 4 | 拡張 | 継続的 | プラグインAPI公開・AI・モバイル |

---

## Phase 0: プロジェクト基盤（1週間）

> **ゴール**: コードを書き始められる開発環境を整える

### タスク

- [ ] モノレポセットアップ（pnpm workspace + Turborepo）
- [ ] `pnpm-workspace.yaml`, `turbo.json`, `biome.json` の作成
- [ ] `packages/core`, `packages/canvas-engine`, `packages/store`, `packages/ui`, `packages/shared` のスキャフォールド
- [ ] `plugins/` ディレクトリの初期プラグインスキャフォールド
- [ ] `apps/web`（Vite + React 19）の初期セットアップ
- [ ] `apps/server`（Hono + Cloudflare Workers）の初期セットアップ
- [ ] TypeScript / Biome / Vitest の共通設定
- [ ] **CI復旧**: lint, typecheck, test, build ジョブをv2パッケージ構成に合わせて有効化
- [ ] Lefthook（Git hooks）のセットアップ
- [ ] Playwright の初期設定
- [ ] Renovate / Dependabot の設定

### 完了基準

- `pnpm install && pnpm build && pnpm test && pnpm lint` が全て通る
- CIが全ジョブ green
- `apps/web` でブランクのCanvasが表示される

---

## Phase 1: MVP（8週間）

> **ゴール**: 「描いて、保存して、共有して、一緒に編集できる」最小プロダクト

### Week 1-2: コア描画エンジン

- [ ] `packages/core` — プラグインAPI、レイヤーシステム、TransientRegistry
- [ ] `packages/canvas-engine` — Canvas コンポーネント、ビューポート、座標変換
- [ ] `packages/store` — Zustand ストア基盤
- [ ] `plugins/usketch-plugin-shape-rect` — 矩形シェイプ + 描画ツール
- [ ] `plugins/usketch-plugin-shape-ellipse` — 楕円シェイプ + 描画ツール
- [ ] `plugins/usketch-plugin-shape-freedraw` — フリーハンドシェイプ + 描画ツール
- [ ] `plugins/usketch-plugin-tool-select` — 選択・移動・リサイズツール（XState）
- [ ] `plugins/usketch-plugin-tool-pan` — パンツール
- [ ] Undo/Redo のコマンドパターン実装

### Week 3-4: 永続化 + エクスポート

- [ ] `packages/store` — Yjs Document 統合、y-indexeddb ローカル保存
- [ ] `apps/server` — Hono API（ボードCRUD）、Cloudflare D1 スキーマ
- [ ] `apps/server` — Better Auth 認証基盤
- [ ] `plugins/usketch-plugin-export` — PNG/SVG エクスポート
- [ ] `plugins/usketch-plugin-shape-text` — テキストシェイプ + テキストツール
- [ ] `plugins/usketch-plugin-bg-grid` — グリッド背景

### Week 5-6: リアルタイムコラボレーション

- [ ] `apps/server` — Durable Objects による Yjs WebSocket 同期
- [ ] `packages/store` — SyncProvider（WebSocket ↔ Yjs Doc）
- [ ] TransientRegistry — Yjs Awareness 経由のカーソル・プレゼンス同期
- [ ] 同時編集時の競合テスト（CRDT自動マージ）
- [ ] オフライン → オンライン復帰の自動同期

### Week 7-8: 共有 + 仕上げ

- [ ] リンク共有・アクセス制御（公開/限定公開）
- [ ] `packages/ui` — ツールバー、サイドパネル、共有ダイアログ
- [ ] UIポリッシュ、レスポンシブ対応
- [ ] パフォーマンスチューニング（仮想化、バッチング）
- [ ] E2E テストシナリオ（描画→保存→共有→コラボの一連フロー）
- [ ] ベータリリース（Cloudflare Pages / Workers デプロイ）

### MVP 完了基準

- ユーザーがURLを開いて描画→自動保存→リンク共有→リアルタイム共同編集ができる
- PNG/SVG エクスポートが動作する
- オフラインで描画 → オンライン復帰で同期される

---

## Phase 2: 成長（4週間）

> **ゴール**: ベータフィードバックを反映し、プロダクトとしての完成度を上げる

- [ ] ベータユーザーフィードバックの収集・対応
- [ ] `plugins/usketch-plugin-snap` — スナップ・スマートガイド（v1資産を移植）
- [ ] `plugins/usketch-plugin-bg-dots` — ドット背景
- [ ] テンプレートシステム（会議用、ブレスト用等）
- [ ] PDFエクスポート（pdf-lib）
- [ ] スタイリング強化（色、線幅、フォント、透明度）
- [ ] キーボードショートカット一覧
- [ ] ボード一覧ダッシュボード

---

## Phase 3: 収益化（4週間）

> **ゴール**: フリーミアムモデルで収益基盤を構築

- [ ] Stripe 統合（課金基盤）
- [ ] Free / Pro / Team プランの実装
- [ ] プラン別の制限（ボード数、同時編集人数、履歴保持期間）
- [ ] チーム管理機能（招待、ロール管理）
- [ ] SSO対応（Team プラン）
- [ ] 監査ログ
- [ ] ランディングページ

---

## Phase 4: 拡張（継続的）

> **ゴール**: エコシステムの拡大

- [ ] プラグインAPI の公開ドキュメント
- [ ] サードパーティプラグインの仕組み（マーケットプレイス検討）
- [ ] AI機能（テキスト → ダイアグラム自動生成）
- [ ] プレゼンテーションモード
- [ ] モバイル対応（タッチ最適化）
- [ ] 公開REST API
- [ ] セルフホスト版

---

## 技術的マイルストーン

Phase 0 で復旧が必要なCI/開発基盤と、各フェーズで追加すべき技術要素をまとめる。

| マイルストーン | Phase | 内容 |
|---------------|-------|------|
| CI復旧 | 0 | `pnpm install`, `lint`, `typecheck`, `test`, `build` ジョブを有効化（現在はドキュメントチェックのみ） |
| E2E基盤 | 1 | Playwright による E2E テスト追加、CI に E2E ジョブ追加 |
| Preview環境 | 1 | PR単位の Cloudflare Pages プレビューデプロイ |
| Staging環境 | 1 | `main` ブランチの自動デプロイ |
| Production環境 | 2 | Git tag / 手動承認でのリリース |
| モニタリング | 2 | エラートラッキング、パフォーマンスモニタリング |
| 負荷テスト | 3 | 同時接続数のベンチマーク |

---

## 現在の状態

- **Phase**: Pre-0（設計完了、コードなし）
- **ブランチ**: `renewal/v2-clean-start`（PR #429）
- **CI**: ドキュメント存在チェック + ファイル名規約チェックのみ（Phase 0 で本格CI復旧予定）
- **成果物**: ポストモーテム、企画書、アーキテクチャ設計書、プラグインシステム設計書、ユースケース集

---

## 関連ドキュメント

- [プロダクト企画書](./new-product-proposal.md) — ビジョン・MVPスコープ・ビジネスモデル
- [アーキテクチャ設計書](./architecture-v2.md) — 技術設計・パッケージ構成・データモデル
- [プラグインシステム設計書](./plugin-system-design.md) — 統一プラグインAPI・レイヤーシステム
- [ユースケース集](./use-cases.md) — 主要ユーザーシナリオとプラグインの動作
