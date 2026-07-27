---
"@edv4h/usketch-plugin-shape-image": minor
---

SVG をベクターのまま画像 shape として表示できるように（#791）。

- **ファイル D&D（ベクター維持）**: `.svg` / `image/svg+xml` のドロップは JPEG へラスタライズせず、サニタイズ済みマークアップを `data:image/svg+xml,…` として `<img src>` に埋め込む。サイズは `width`/`height`、無ければ `viewBox` から算出（従来の `naturalWidth === 0` 問題を回避）。
- **`.svg` URL のドロップ／ペースト対応**: 新規 `createImageUrlHandler`（`order: 5`）が `.svg` URL を画像 shape 化。embed の汎用 URL ハンドラ（`order: 0`）より優先されるため、SVG リンクは iframe でなく画像として配置される。それ以外の URL は従来どおり embed にフォールスルー。
- **サニタイズ徹底**: 取り込み時に `<script>` / `<foreignObject>`・`on*` イベントハンドラ属性・`javascript:` な (x)href/src を除去（`sanitizeSvg`）。`<img>` の非スクリプト実行コンテキストによるブラウザ保証に加えた多層防御。パース不能・非 SVG は取り込み拒否。リモート `.svg` URL は取得しないためサニタイズ不可だが、同じ `<img>` 非スクリプト保証に依拠。
