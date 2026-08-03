---
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-tool-select": patch
"@edv4h/usketch-connector-anchor": minor
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-shared": minor
---

回転まわりの選択 UI を2点修正。

- **グループ回転でコネクタが崩れる不具合を修正**。コネクタは形状を端点（source/target/control point・絶対座標）で定義するため、グループ回転で `rotation` を焼き込むと「端点＋回転」の二重変換になり、線が本体・接続先から外れ、選択枠（ハンドル）も大きくズレていた。`ShapeDefinition.rotate` フック（`move` と対の関係）を追加し、コネクタは端点を回して `rotation` は据え置くようにした（`rotateConnector`）。これで本体・端点ハンドル・選択枠が一致する。
- **回転ハンドルのカーソルを角ごとの回転アイコンにした**。従来は全ての角で `grab` 固定だったが、掴んだ角（ne/se/sw/nw）＋シェイプの現在回転角に合わせて向けた回転カーソル（150°円弧＋接線方向ダブル矢じりの SVG data URI）を表示する。`tool-helpers` に `getRotationCursor(corner, rotationDeg)` を追加し、`findRotationHandleAtScreenPoint` はどの角かも返すようになった（戻り値が `string` から `{ shapeId, corner }` に変更）。
