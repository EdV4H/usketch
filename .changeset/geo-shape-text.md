---
"@edv4h/usketch-shape-utils": minor
"@edv4h/usketch-plugin-shape-basic": minor
"@edv4h/usketch-plugin-shape-text": patch
"@edv4h/usketch-plugin-shape-sticky": patch
---

GeoShape（rectangle/rounded-rect/ellipse/triangle/diamond/star）に付箋同様の編集可能ラベルを追加。あわせて text/sticky/geo で重複していたテキスト編集機構を共通化。

- **shape-utils**: 編集機構を `createEditableTextController`（zag マシン + double-click 検出 + 外側クリック/blur/Esc/選択解除の終了 + undo コミット）と `editableTextProps`（contentEditable の共通ハンドラ）に抽出。text/sticky が各自コピーしていた machine を 3→1 に統一（zag は shape-utils の依存へ移動、react は peer）。`isEditableType` で対象型を、`growHeight` で入力時の高さ追従を切替。
- **shape-basic (geo)**: 2D 図形に SVG `<text>`/`<foreignObject>` の中央ラベルを追加し、ダブルクリックで編集。`growHeight:false`（図形サイズは維持しテキストは中央で折り返し）。arrow/line は対象外。GPU 描画時はラベル非表示（SVG 描画時のみ）。
- **shape-text / shape-sticky**: 挙動そのままで共通コントローラへ移行（各自の machine を削除、zag 依存も除去）。
