---
"@edv4h/usketch-connector-anchor": minor
"@edv4h/usketch-plugin-shape-connector": patch
---

custom アンカーの端点を接続先 shape からの相対位置（`sourceAnchorRatio` / `targetAnchorRatio`）として保持し、tracker がそこから端点を再計算するように変更。フレームごと・範囲選択ごとに矢印を移動したとき、端点が二重に移動して矢印が変な方向を向く不具合を修正。`getAnchorRatio` / `getPointFromAnchorRatio` を追加。
