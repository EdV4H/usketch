# @edv4h/usketch-plugin-server-chat

## 1.1.0

### Minor Changes

- d1208fc: チャットをページごとに分けられるようにした。
  
  - server-chat: `chat_messages` に `page_id` 列があれば、一覧の `?pageId=`（と `&includeUnpaged=1`）と投稿の `pageId` でページごとに分ける。`createChatPlugin(schema, { pageFilter })` を渡すと、見られないページのチャットは読めず書けない（404）。列が無いスキーマはこれまでどおり。
  - community-chat: `createCommunityChatPlugin({ page: { id, includeUnpaged } })` で今のページのチャットだけを読み書きする。`page` を渡さなければこれまでどおりボードで 1 つ。

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
