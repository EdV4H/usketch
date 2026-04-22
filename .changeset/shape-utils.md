---
"@edv4h/usketch-shape-utils": major
"@edv4h/usketch-plugin-shape-basic": minor
---

✨ feat: add `@edv4h/usketch-shape-utils` for third-party shape plugins

shape プラグイン共通ユーティリティ（`getBounds` / `createResize` / `aabbHitTest` / `ellipseHitTest` / `pointInPolygon` / `lineHitTest` / GPU primitive ヘルパ）を新パッケージ `@edv4h/usketch-shape-utils` として切り出し、サードパーティが `@acme/usketch-plugin-shape-foo` のような独自 shape プラグインを作る際に再利用できるようにした。

`@edv4h/usketch-plugin-shape-basic` は内部実装を `shape-utils` 依存に切り替え。公開 API / 動作は不変のため破壊的変更なし。

詳細は `apps/docs` の「Third-Party Plugin Authoring」ガイドを参照。
