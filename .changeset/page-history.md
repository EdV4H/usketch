---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-sync": minor
---

マルチページ: 履歴をページ対応

- `@edv4h/usketch-shared`: `HistoryCommit.layout` を追加。`"pages"` のコミットは tree がページ（pageId → そのページの tree）で並ぶ。無いコミット（今までのもの）はハッシュも中身も変わらない
- `@edv4h/usketch-sync`: `LEGACY_PAGE_ID_KEY` と `getLegacyPageId(root)` を追加。ページ形式にする前の中身が移ったページ（記録が無ければ先頭ページ）
