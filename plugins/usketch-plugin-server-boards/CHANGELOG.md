# @edv4h/usketch-plugin-server-boards

## 2.0.0

### Major Changes

- 4f0260c: デモの地域（ワールドマップ）をデモボードのページにした（#1558 R6）。
  
  - server-boards: **破壊的変更**。ワールドマップの地域の API（`GET /api/community-boards`・`GET /api/community-boards/:slug`）と、地域のボードを作る処理を削除した。`community_boards` 表（ログインした人を編集者にするボードの印）はこれまでどおり使う。
  - shape-board-portal: ゲートのデータに `pageId`（このボードのページへ行くゲート）を足した。
  - board-info-panel: 選んだゲートに `pageId` があれば、`onOpenBoard(boardId, pageId)` で渡す。

### Minor Changes

- 0691f98: ログインしていない人が公開ボードを見るための WebSocket `GET /public/boards/:boardId/ws` を足した。公開ボードだけにつなぎ、役割の無い閲覧者（`userId=anonymous`）として DO へ渡す。

## 1.2.0

### Minor Changes

- bf7d536: Let the server check pages for comments, history, thumbnails and AI writes.
  
  - server-comments: new optional `pageFilter` option (second argument of `createCommentsPlugin`). Threads on pages the viewer may not view are left out of the list, and creating, replying to, resolving or deleting them returns 404.
  - server-boards: after adding or removing a member, changing `isPublic` or deleting a board, it posts `/access-changed` to the board's Durable Object so open connections pick up the new role. The history proxy and the public thumbnail route pass `boardId` to the Durable Object.
  - server-ai: the calls that write shapes to the Durable Object pass `boardId` and `userId`, so it can check that the caller may edit the page.

## 1.1.1

### Patch Changes

- ec3534c: Enforce board roles on the server side.
  
  - `server-boards`: the `/api/boards/:id/ws` proxy now tells the Durable Object the caller's board role (`role`: owner / editor / viewer, omitted for non-members of a public board) and whether the board is public (`boardPublic`: `1` / `0`). Values sent by the client are always overwritten. Community boards are passed as `editor`. A Durable Object can use these to refuse writes (the demo server drops Yjs updates from viewers and from people only viewing a public board).
  - `server-ai`: `POST /api/ai/complete` places shapes, so it now answers 403 to viewers and to non-members of a public board. Pass the new optional `communityBoards` table to `createAiPlugin` to keep letting anyone place shapes on community boards.

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
