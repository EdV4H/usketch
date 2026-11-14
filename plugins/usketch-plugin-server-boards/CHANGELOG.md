# @edv4h/usketch-plugin-server-boards

## 1.1.0

### Minor Changes

- acef918: ボード履歴 API（`/api/boards/:boardId/history`、`/history/*`）のプロキシを追加。あわせて、snapshot / history の Durable Object プロキシでボードのアクセス権を確認するようにした（メンバーか公開ボードなら読める、viewer は書き込み不可）。これまでは認証だけで、メンバーでないユーザーも他人のボードのスナップショットを読めた。userId はサーバー側で付け直す。
- 1a2b88e: 旧スナップショットの Time Travel を削除し、ボード履歴（`@edv4h/usketch-plugin-history`）に一本化した。canvas-filter は Time Travel タブ・バナー・`filter:time-travel-exit` アクション・`time-travel:request` の受け口を外し、`boardRoomApiUrl` オプションは無視するようになった（型は残して deprecated）。server-boards は `/api/boards/:id/snapshots`・`/snapshot` のプロキシを外した。

### Patch Changes

- 1cd5107: マルチページ PR3a: AI とサムネイルをページ対応。
  
  - `@edv4h/usketch-plugin-ai-agent`: `pageId` オプションを追加。ページを使うボードでは、AI の配置・更新をこのページに書く。
  - `@edv4h/usketch-plugin-server-ai`: `/api/ai/complete` が `pageId`（省略可）を受け取り、BoardRoom に渡す。
  - `@edv4h/usketch-plugin-server-boards`: 公開サムネイルが `?page=` を受け取る（省略時は先頭ページ）。
  
  ページを使わないボード（`meta.pagesVersion` が無い）はこれまでどおりルート doc の `shapes` を読み書きする。

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
  - @edv4h/usketch-server-core@1.0.0
