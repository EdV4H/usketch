---
"@edv4h/usketch-plugin-ai-agent": minor
"@edv4h/usketch-plugin-server-ai": minor
"@edv4h/usketch-plugin-server-boards": patch
---

マルチページ PR3a: AI とサムネイルをページ対応。

- `@edv4h/usketch-plugin-ai-agent`: `pageId` オプションを追加。ページを使うボードでは、AI の配置・更新をこのページに書く。
- `@edv4h/usketch-plugin-server-ai`: `/api/ai/complete` が `pageId`（省略可）を受け取り、BoardRoom に渡す。
- `@edv4h/usketch-plugin-server-boards`: 公開サムネイルが `?page=` を受け取る（省略時は先頭ページ）。

ページを使わないボード（`meta.pagesVersion` が無い）はこれまでどおりルート doc の `shapes` を読み書きする。
