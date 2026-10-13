---
"@edv4h/usketch-plugin-asset-store": minor
---

`AssetStore.maxUploadBytes()` を追加。現在の uploader が受け付けられるペイロードの上限（バイト）を返す。既定の uploader（ペイロードを 1 回の Yjs update としてドキュメントへ直接書く）の間は `inlineMaxBytes`（`createAssetStore` / `createAssetStorePlugin` のオプション、既定 4MB）を返し、`setUploader` で差し替えた後は上限なし（`undefined`）を返す。「ドキュメントにどこまで入るか」をストア自身が答えるので、呼び出し側は uploader の種類を知らずにサイズを事前判定できる。
