---
"@edv4h/usketch-shared": patch
"@edv4h/usketch-plugin-map": minor
"@edv4h/usketch-plugin-elevation": minor
"@edv4h/usketch-plugin-shape-3d": minor
"@edv4h/usketch-plugin-character": minor
---

地面と固体の高さを、ボードの高さの窓口（`ctx.height` / `boardHeight`）から読み書きするようにしました（3D 標準対応 P3b、#1469）。今の動きは変わりません。

- **map**: 地形を地面の提供元（優先度 0、`heightEnabled` のときだけ）として登録します。崖は「地面の持ち主が map のとき」だけ描きます
- **elevation**: 標高を地面の提供元（優先度 `ELEVATION_GROUND_PRIORITY` = 10、場があるときだけ）として登録します。map を包む処理をやめたので、プラグインの並び順によりません。古い map のために `setHeightEnabled` での切り替えは次のメジャーまで続けます
- **shape-3d**: 当たり判定を固体の提供元として登録し、地面の高さを窓口から読みます
- **character**: 地面と固体の高さを窓口から読みます
- `groundHeightService` / `solidHeightService` は窓口が答え続けるので、これらを読む・provide する古いプラグインとも組めます
