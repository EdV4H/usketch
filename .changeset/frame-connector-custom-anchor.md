---
"@edv4h/usketch-connector-anchor": minor
"@edv4h/usketch-plugin-shape-connector": minor
---

custom アンカーの端点を接続先 shape からの相対位置（`sourceAnchorRatio` / `targetAnchorRatio`）として保持し、tracker がそこから端点を再計算するように変更。フレームごと・範囲選択ごとに矢印を移動したとき、端点が二重に移動して矢印が変な方向を向く不具合を修正。`getAnchorRatio` / `getPointFromAnchorRatio` を追加。

比率を持たない既存データの custom 端点は、tracker が初期化時・追加時の位置から比率を補完し、最初に追従したときに書き込む。HUD のアンカー変更は `computeAnchorChange`（新規 export）に切り出し、「手動」に切り替えても端点が shape の中心に飛ばず、現在の位置を保つようにした。
