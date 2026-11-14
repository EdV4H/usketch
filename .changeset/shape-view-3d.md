---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-shape-3d": minor
"@edv4h/usketch-plugin-shape-basic": patch
"@edv4h/usketch-plugin-shape-sticky": patch
"@edv4h/usketch-plugin-shape-image": patch
"@edv4h/usketch-plugin-shape-openui": patch
"@edv4h/usketch-plugin-shape-card": patch
"@edv4h/usketch-plugin-shape-frame": patch
"@edv4h/usketch-plugin-shape-embed": patch
---

Shape の 3D をコアのデータにしました（3D 標準対応 P4a、#1473）。絵は変わりません。

- **shared**
  - `ShapeData.view3d`（stand / box / float、高さ、向き、影、当たり判定）を追加
  - 読み書きの純関数（`readShapeView3d`、`resolveShapeView3d`、`storedShapeView3d`、`shapeView3dPatch` など）を追加
  - `ShapeDefinition.view3d`（`modes` / `default` / `render3d`）を追加
  - 次のメジャーまで、書くときは `view3d` と `x-shape-3d` の両方に書きます。読むときは、まだ `x-shape-3d` があればそちらを読みます（古いクライアントはそちらにしか書かないため）
- **core**: `ctx.shapes.configureView3d(type, view3d)` で、ホストが種別ごとの 3D を上書きできます（`getView3d` / `subscribeView3d` も追加。次のメジャーまで省略可）
- **shape-3d**: 各種別の宣言とホストの上書きを読みます。`types` オプション・`registerType`・組み込みの表は、まだ宣言していない種別のため次のメジャーまで残します
- **各 Shape プラグイン**: 自分の 3D を宣言します
  - rectangle・rounded-rect・sticky・card・frame・image は箱にもなれます
  - embed・openui は 3D にしません
