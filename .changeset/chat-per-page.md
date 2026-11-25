---
"@edv4h/usketch-plugin-server-chat": minor
"@edv4h/usketch-plugin-community-chat": minor
---

チャットをページごとに分けられるようにした。

- server-chat: `chat_messages` に `page_id` 列があれば、一覧の `?pageId=`（と `&includeUnpaged=1`）と投稿の `pageId` でページごとに分ける。`createChatPlugin(schema, { pageFilter })` を渡すと、見られないページのチャットは読めず書けない（404）。列が無いスキーマはこれまでどおり。
- community-chat: `createCommunityChatPlugin({ page: { id, includeUnpaged } })` で今のページのチャットだけを読み書きする。`page` を渡さなければこれまでどおりボードで 1 つ。
