---
"@edv4h/usketch-sync": minor
---

マルチページ: 既存ボードの移行関数を追加

ページ形式にする前のボード（ルート doc の `shapes`）を、1 枚目のページ doc へ移す純関数。自前のサーバーを持つ利用先も、自分のサーバーで同じ手順を使える。

- `needsPagesMigration(root)`: 移行が要るボードか（`meta.pagesVersion` が無い）
- `copyRootShapesToPage(root, pageDoc)`: 手順 1。ルートの `shapes` を 1 枚目のページ doc へ写す（ルートは変えない）
- `finishPagesMigration(root, pageDoc, { pageId, name? })`: 手順 2。ページ doc を保存してから呼ぶ。ルートに 1 枚目と版・`meta.legacyPageId` を書き、写し終えたシェイプをルートから消す
- `moveRootShapesToPage(root, pageDoc)`: 移行後にルートへ書かれたシェイプ（古いクライアントなど）を 1 枚目へ移す
- `checkPagesMigration(before, root, pageDoc)`: 移行前のシェイプが全部 1 枚目に同じ中身であり、ルートが空かを確かめる
- `countRootShapes(root)`、`DEFAULT_FIRST_PAGE_NAME`
