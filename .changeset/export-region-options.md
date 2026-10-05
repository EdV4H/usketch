---
"@edv4h/usketch-plugin-export": minor
"@edv4h/usketch-shared": minor
---

`exportRegion` / `buildRegionSvg` を拡張。`onShapeError`（シェイプ単位の失敗を skip / プレースホルダーにして全体を失敗させない）、`renderShape` と `ShapeDefinition.renderForExport`（書き出し専用の描画）、`loadAdditionalAsset`（Satori の追加フォント読み込み）を追加。
