---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-plugin-tool-select": patch
---

3D 表示で選択枠が地面の高さ 0 に描かれ、丘の上の Shape・箱の天面・浮いた Shape・立った看板とずれていたのを直しました（#1304）。選択ツールは 3D の間、各 Shape が実際に描かれている面の輪郭を傾かない層に重ねて描き、平面用の枠とハンドルは隠します。`shapeView3dQuad` / `projectQuad3d` と、`view3dPickService` の `outlineOf` を追加しました。
