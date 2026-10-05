---
"@edv4h/usketch-plugin-asset-store": minor
---

`AssetStore.hasCustomUploader()` を追加。`setUploader` で既定の uploader（ペイロードを Yjs ドキュメントへ直接書く）が差し替えられたかを返す。大きなペイロードを、ドキュメントの外へ出せる時だけ受け付けたい呼び出し側が使う。
