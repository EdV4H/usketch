---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-dom-renderer": minor
---

**画角外シェイプの LOD 表示（per-shape viewport LOD）** を追加。カメラ画角の外にあるシェイプを簡略（LOD）描画してパフォーマンスを改善する。

- `LayerRenderContext` に `viewportBounds`（world 座標の可視領域）を追加。`canvas-engine` が `ResizeObserver` で計測した canvas サイズと viewport から算出し全レイヤーへ供給（GPU/minimap/カリングでも再利用可）。
- `@edv4h/usketch-shared` に純ヘルパー `getShapeAABB` / `rectsIntersect` / `scaleRectAboutCenter` / `isShapeOutsideViewport` を追加。
- `dom-renderer` の per-shape LOD 判定を「グローバル LOD（zoom/count/fps）**OR** 画角外」に拡張。画角外は既存の `simplifiedComponent ?? LodFallback` で簡略描画。
- `createDomRendererPlugin({ viewportLod })` で設定可能（既定 ON）。`viewportLod.ratio` = 本描画とする画角の割合（**既定 1.2**＝120% でポップイン緩衝、1.0=画角ちょうど、0.5=中央50%のみ本描画）。`false` で無効化。
- LOD は描画のみ。シェイプ data は不変で、画角外でも全件が snapshot/同期に残る。
