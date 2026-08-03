---
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-tool-select": patch
"@edv4h/usketch-tool-helpers": minor
---

回転まわりの選択 UI を2点修正。

- **connector の選択インジケーターが回転に追従しない不具合を修正**。端点/制御点ハンドル・ガイド線・ドラッグプレビューを、connector 本体と同じ中心・角度で回転させて描画するようにした（端点は非回転座標で保持されるため、表示時に回転・ドラッグ時に逆回転して整合を取る）。
- **回転ハンドルのカーソルを角ごとの回転アイコンにした**。従来は全ての角で `grab` 固定だったが、掴んだ角（ne/se/sw/nw）＋シェイプの現在回転角に合わせて向けた回転カーソル（SVG data URI）を表示する。`tool-helpers` に `getRotationCursor(corner, rotationDeg)` を追加し、`findRotationHandleAtScreenPoint` はどの角かも返すようになった（戻り値が `string` から `{ shapeId, corner }` に変更）。
