# @edv4h/usketch-plugin-asset-store

## 0.1.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 0.1.0

### Minor Changes

- fa98ca4: アセットストアを追加（issue #738、tldraw `TLAssetStore` 相当）。画像などの重い blob を **content-addressed な asset レコード**として共有 `Y.Doc` の `assets` マップに一度だけ保持し、shape は `assetId` 参照のみを持つ。既存 Durable Object が任意 Y.Map を汎用リレー＆永続するため**サーバ改修なし**で全クライアント同期・遅参加/再接続でも再利用できる。
  - 新規 `usketch-plugin-asset-store`: `createAssetStore(doc)`（既定 upload は `asset:<hash>` の content-hash dedup、`resolve`、`setUploader`/`setResolver` で外部アップロード/署名URLに差し替え可能）、`ctx.services` 経由で提供（`getAssetStore(ctx)`）。プラグインが自由に put/resolve できる汎用機構。
  - `usketch-plugin-shape-image`: 取り込んだ画像を asset ストアへ upload し shape は `assetId` 参照に。**複製・同一画像の再取り込みで base64 が重複せず同期も1回**。描画は asset マップを購読して remote 到着時に再描画、AI/認識シリアライズは assetId を解決。既存の inline `src`（data:/URL）は後方互換で従来どおり。
