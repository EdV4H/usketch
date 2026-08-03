---
"@edv4h/usketch-plugin-shape-connector": minor
"@edv4h/usketch-plugin-tool-select": patch
"@edv4h/usketch-connector-anchor": minor
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-shared": minor
---

回転まわりの選択 UI を修正。

- **複数選択したシェイプを回転できるようにした**。従来は回転ハンドルの検出が単一選択限定で、複数選択（グループ化していない選択）は回転できなかった。複数選択のバウンディングボックスの角外側に回転ゾーンを追加し、選択中の全シェイプを共通中心まわりに剛体回転する `startMultiRotateSession` を追加（コネクタは端点回転、undo/redo 対応）。ホバー時は回転カーソルも出る。
- **図形のコネクタ・アンカーハンドル（上下左右）が図形の回転に追従するようにした**。従来は回転した図形でもアンカー（コネクタの始点/接続点）が軸平行の辺の中点に出ていて、辺から外れていた。`getAnchorPoint` / `clampToShapeEdge` を回転対応にし（ローカル座標で計算 → 中心まわりに回転して world 座標へ）、選択時の外側オフセットも辺の法線方向へ回すようにした。これで回転済み図形からも正しい辺の位置でコネクタを繋げられる。
- **グループ回転でコネクタが崩れる不具合を修正**。コネクタは形状を端点（絶対座標）で定義するため、グループ回転で `rotation` を焼き込むと二重変換で線・ハンドルが崩れていた。`ShapeDefinition.rotate` フック（`move` と対）を追加し、コネクタは端点を回して `rotation` は据え置く（`rotateConnector`）。
- **回転ハンドルのカーソルを角ごとの回転アイコンにした**。従来は全ての角で `grab` 固定だったが、掴んだ角（ne/se/sw/nw）＋シェイプの現在回転角に合わせた回転カーソル（150°円弧＋接線方向ダブル矢じりの SVG data URI）を表示する。`tool-helpers` に `getRotationCursor(corner, rotationDeg)` を追加し、`findRotationHandleAtScreenPoint` はどの角かも返すようになった。
