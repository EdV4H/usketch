---
"@edv4h/usketch-plugin-shape-image": minor
"@edv4h/usketch-shape-utils": minor
"@edv4h/usketch-plugin-shape-card": patch
---

feat(shape-image): 画像Shapeごとにリサイズ挙動を選べるようにした。`resizeMode`（`"keep-aspect"` 既定 / `"free"`）と、自由リサイズ時の収まり方 `fit`（`"contain"` 既定 / `"cover"` / `"fill"`）を追加し、Control HUD の「画像のリサイズ」から選択中の画像に設定できる。取り込み時に元画像の縦横比を `aspectRatio` として保存する。操作は純関数 `setImageResizeMode` / `setImageFit` と `getImageApi` サービスで公開。`@edv4h/usketch-shape-utils` にアスペクト比固定リサイズの共有ヘルパー `createAspectResize` を追加し、card の `makeAspectResize` はそれを使うように変更（挙動は同じ）。
