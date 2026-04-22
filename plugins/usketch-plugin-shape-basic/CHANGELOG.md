# @edv4h/usketch-plugin-shape-basic

## 1.1.0

### Minor Changes

- 07fdeeb: ✨ feat: add `@edv4h/usketch-shape-utils` for third-party shape plugins

  shape プラグイン共通ユーティリティ（`getBounds` / `createResize` / `aabbHitTest` / `ellipseHitTest` / `pointInPolygon` / `lineHitTest` / GPU primitive ヘルパ）を新パッケージ `@edv4h/usketch-shape-utils` として切り出し、サードパーティが `@acme/usketch-plugin-shape-foo` のような独自 shape プラグインを作る際に再利用できるようにした。

  `@edv4h/usketch-plugin-shape-basic` は内部実装を `shape-utils` 依存に切り替え。公開 API / 動作は不変のため破壊的変更なし。

  詳細は `apps/docs` の「Third-Party Plugin Authoring」ガイドを参照。

### Patch Changes

- Updated dependencies [07fdeeb]
  - @edv4h/usketch-shape-utils@1.0.0

## 1.0.0

### Major Changes

- 🎉 Initial stable release — v1.0.0

  uSketch v2 の最初の安定版リリース。MVP 完了基準をすべて満たした状態で公開する。

  ## Highlights

  - **Realtime collaboration** — Cloudflare Durable Objects + Yjs + WebSocket awareness
  - **Offline-first** — y-indexeddb によるローカル永続化、再接続時の自動同期
  - **Pluggable architecture** — 60+ の plugin（shape / tool / sync / AI / presence / export 等）
  - **Presentation mode** — Frame ベースのスライド、edit/present の 2 モード
  - **Export** — PNG / SVG / JSON（Satori + Canvas）
  - **Link sharing & access control** — 公開/限定公開 + role 管理（owner/editor/viewer）
  - **AI-native** — Copilot（ghost shape 提案）/ Chat / Voice / Image 認識

  詳細なリリースノートはルートの `CHANGELOG.md` を参照。

### Patch Changes

- Updated dependencies
  - @edv4h/usketch-core@1.0.0
  - @edv4h/usketch-shared@1.0.0
  - @edv4h/usketch-store@1.0.0
