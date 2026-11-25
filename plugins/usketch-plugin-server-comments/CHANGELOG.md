# @edv4h/usketch-plugin-server-comments

## 1.2.0

### Minor Changes

- bf7d536: Let the server check pages for comments, history, thumbnails and AI writes.
  
  - server-comments: new optional `pageFilter` option (second argument of `createCommentsPlugin`). Threads on pages the viewer may not view are left out of the list, and creating, replying to, resolving or deleting them returns 404.
  - server-boards: after adding or removing a member, changing `isPublic` or deleting a board, it posts `/access-changed` to the board's Durable Object so open connections pick up the new role. The history proxy and the public thumbnail route pass `boardId` to the Durable Object.
  - server-ai: the calls that write shapes to the Durable Object pass `boardId` and `userId`, so it can check that the caller may edit the page.

## 1.1.0

### Minor Changes

- 78ab2fe: マルチページ: コメントにページを記録する
  
  - `@edv4h/usketch-plugin-comments`: `pages` オプション（今のページ・`legacyPageId`・`pageName`・`switchPage`）。新しいコメントにページを記録し、一覧で別のページのコメントにそのページ名のボタンを出す（押すとそのページを開く）
  - `@edv4h/usketch-plugin-server-comments`: スレッド作成で `pageId`（省略可）を受け取り、`comments` テーブルに `pageId` 列（`page_id`）があれば保存する。列の無いスキーマでもこれまでどおり動く

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
