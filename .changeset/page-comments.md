---
"@edv4h/usketch-plugin-comments": minor
"@edv4h/usketch-plugin-server-comments": minor
---

マルチページ: コメントにページを記録する

- `@edv4h/usketch-plugin-comments`: `pages` オプション（今のページ・`legacyPageId`・`pageName`・`switchPage`）。新しいコメントにページを記録し、一覧で別のページのコメントにそのページ名のボタンを出す（押すとそのページを開く）
- `@edv4h/usketch-plugin-server-comments`: スレッド作成で `pageId`（省略可）を受け取り、`comments` テーブルに `pageId` 列（`page_id`）があれば保存する。列の無いスキーマでもこれまでどおり動く
