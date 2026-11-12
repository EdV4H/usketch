---
"@edv4h/usketch-sync": minor
"@edv4h/usketch-plugin-sync-localstorage-yjs": minor
---

マルチページのクライアント基盤（マルチページ PR2）。

- `@edv4h/usketch-sync`: ルート doc の `pages` / `meta.pagesVersion` を扱う純関数（`listPages`・`createPage`・`initPagedBoard`・`isPagedBoard`・`resolvePageId`・`observePages` など）、ページ doc を手元保存とサーバー購読つきで開き直前のページを残す `createPageDocManager`、同じページの人だけを見せる awareness / broadcast の包み `createPageScopedProvider` を追加。
- `@edv4h/usketch-plugin-sync-localstorage-yjs`: `createYjsSync` に `persist: false`（保存はホストが持ち、doc の中身をすぐ store に入れる）を追加し、doc を IndexedDB に保存するだけの `persistDocToIndexedDb` を公開。

`meta.pagesVersion` の無いボードはこれまでどおりルート doc の `shapes` を使う。
