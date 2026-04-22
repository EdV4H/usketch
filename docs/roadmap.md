# uSketch v2 開発ロードマップ

**作成日**: 2026-03-14
**最終更新**: 2026-04-22
**現状**: ✅ **v1.0.0 リリース済み**

---

## フェーズ概要

| Phase | 名称 | 期間 | 状態 |
|-------|------|------|------|
| 0 | プロジェクト基盤 | 1週間 | ✅ 完了 |
| 1 | MVP | 8週間 | ✅ 完了（v1.0.0 リリース） |
| 1.5 | リリース衛生 | 2〜3日 | ✅ 完了（v1.0.0） |
| 2 | 運用・品質強化 | 4週間 | 🚧 v1.1.0 スコープ |
| 3 | 収益化 | 4週間 | 📋 v1.2.0 予定 |
| 4 | 拡張 | 継続的 | 📋 継続 |

---

## Phase 0: プロジェクト基盤 ✅ 完了

- [x] モノレポセットアップ（pnpm workspace + Turborepo）
- [x] `packages/*`, `plugins/*` のスキャフォールド
- [x] `apps/web`（Vite + React 19）
- [x] `apps/server`（Hono + Cloudflare Workers）
- [x] TypeScript / Biome / Vitest / Playwright
- [x] CI（lint / typecheck / test / build / e2e / deploy）
- [x] Lefthook（Git hooks）
- [x] Renovate

---

## Phase 1: MVP ✅ 完了（v1.0.0 リリース）

### コア描画エンジン
- [x] `packages/core` — プラグイン API、レイヤーシステム、TransientRegistry
- [x] `packages/canvas-engine` — Canvas / ビューポート / 座標変換
- [x] `packages/store` — Zustand ボードストア + Undo/Redo
- [x] `plugins/usketch-plugin-shape-basic`, `shape-text`, `shape-freedraw` 等
- [x] `plugins/usketch-plugin-tool-select`（XState）
- [x] `plugins/usketch-plugin-tool-pan`

### 永続化 + エクスポート
- [x] `plugins/usketch-plugin-sync-localstorage-yjs` — y-indexeddb 永続化
- [x] `apps/server` — Hono API + Cloudflare D1 + Drizzle ORM
- [x] Better Auth 認証基盤
- [x] `plugins/usketch-plugin-export` — PNG/SVG/JSON
- [x] `plugins/usketch-plugin-shape-text`
- [x] `plugins/usketch-plugin-bg-grid`, `bg-dots`

### リアルタイムコラボレーション
- [x] `apps/server` — Durable Objects による Yjs WebSocket 同期
- [x] `packages/sync` — WebSocket provider（awareness + 再接続）
- [x] TransientRegistry 経由のカーソル・プレゼンス同期
- [x] CRDT 自動マージ
- [x] オフライン → オンライン復帰の自動同期

### 共有 + 仕上げ
- [x] リンク共有・アクセス制御（公開/限定公開、role 管理）
- [x] `packages/ui` + `apps/web/src/components` — Toolbar / SidePanel / ShareDialog
- [x] ダーク/ライトテーマ
- [x] E2E テスト（7 シナリオ）
- [x] Cloudflare Pages / Workers へのデプロイ

### Phase 1 で想定外に追加されたもの

- AI ネイティブ機能（ai-agent / ai-chat / ai-copilot / ai-voice / ai-image / ai-recognize / ai-actions）
- プレゼンテーションモード（Frame ベース、Canvas flavor）
- 拡張プレゼンス（presence-enhanced / follow-me / spotlight / laser / reactions / whistle）
- コミュニティ機能（spatial-chat / community-chat / shape-community-region / shape-board-portal）
- Comments / Voting / Activity feed
- MCP サーバー（Claude Code 連携）

---

## Phase 1.5: リリース衛生 ✅ 完了（v1.0.0）

- [x] LICENSE（MIT）
- [x] SECURITY.md
- [x] CHANGELOG.md（root + 各パッケージ）
- [x] Changesets 導入
- [x] 全 62 パッケージを 1.0.0 に昇格（apps/* は ignore）
- [x] README.md 刷新
- [x] docs/v1/ レガシー削除

---

## Phase 2: 運用・品質強化（v1.1.0 スコープ）

> **ゴール**: 本番運用に耐える観測性と品質を整える

### 観測性
- [ ] エラートラッキング（Sentry）の導入 — web / server 両方
- [ ] 構造化ログ（Pino）— apps/server
- [ ] パフォーマンスモニタリング

### セキュリティ
- [ ] `dependabot.yml` 追加
- [ ] CI に `pnpm audit` ステップ追加
- [ ] Privacy policy / Terms of service（`docs/privacy.md`, `docs/terms.md`）
- [ ] apps/web フッターに PP/ToS リンク

### 既知バグ消化
- [ ] [#551](https://github.com/EdV4H/usketch/issues/551) monorepo HMR
- [ ] [#537](https://github.com/EdV4H/usketch/issues/537) GPU/DOM z-order
- [ ] [#510](https://github.com/EdV4H/usketch/issues/510) AI Copilot 座標変換
- [ ] [#499](https://github.com/EdV4H/usketch/issues/499) Renovate ビルドエラー
- [ ] [#514](https://github.com/EdV4H/usketch/issues/514) WebGPU/DOM パフォーマンス検証

### テスト
- [ ] apps/server 単体テスト拡充
- [ ] E2E: リアルタイム同期、権限、エラーケース

### 機能拡充
- [ ] PDF エクスポート（pdf-lib）
- [ ] テンプレートシステム（会議用、ブレスト用等）
- [ ] キーボードショートカット一覧画面

---

## Phase 3: 収益化（v1.2.0 予定）

> **ゴール**: フリーミアムモデルで収益基盤を構築

- [ ] Stripe 統合
- [ ] Free / Pro / Team プラン
- [ ] プラン別制限（ボード数、同時編集人数、履歴保持期間）
- [ ] チーム管理機能（招待、ロール）
- [ ] SSO（Team プラン）
- [ ] 監査ログ
- [ ] ランディングページ

---

## Phase 4: 拡張（継続的）

> **ゴール**: エコシステム拡大

- [ ] プラグイン API 公開ドキュメント（apps/docs の拡充）
- [ ] サードパーティプラグイン（マーケットプレイス検討）
- [ ] モバイル対応（タッチ最適化）
- [ ] 公開 REST API
- [ ] セルフホスト版

---

## 技術的マイルストーン

| マイルストーン | 状態 |
|---------------|------|
| CI 復旧（lint/typecheck/test/build/e2e/deploy） | ✅ 完了 |
| E2E 基盤（Playwright） | ✅ 完了 |
| Preview 環境（PR ごとの Cloudflare Pages preview） | ✅ 完了 |
| Staging 環境（main 自動デプロイ） | ✅ 完了 |
| Production 環境（v1.0.0 リリース） | ✅ 完了 |
| モニタリング（Sentry 等） | 📋 v1.1.0 |
| 負荷テスト | 📋 v1.2.0 |

---

## 関連ドキュメント

- [CHANGELOG](../CHANGELOG.md) — リリース履歴
- [プロダクト企画書](./new-product-proposal.md)
- [アーキテクチャ設計書](./architecture-v2.md)
- [プラグインシステム設計書](./plugin-system-design.md)
- [ユースケース集](./use-cases.md)
- [ポストモーテム](./postmortem.md)
