---
"@edv4h/usketch-plugin-shape-connector": minor
"@edv4h/usketch-connector-anchor": minor
"@edv4h/usketch-store": minor
---

feat(connector): コネクタの自由端点に対応（通常の矢印）。`connector-draw`（L）とアンカーハンドルからの作成で、図形上なら接続、何もない所ならその座標で端点を固定する（片側だけの接続も可、画面上 4px 未満のドラッグは破棄）。端点ハンドルのドラッグで自由端の移動・図形への接続・切り離しができる。片側接続のコネクタは接続側だけ図形に追従し、接続先の図形が削除されると切り離して自由端になる（Undo で再接続）。`CascadeDeleteStore` に `updateShape` が必須になった。
