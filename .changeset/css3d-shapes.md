---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-dom-renderer": minor
"@edv4h/usketch-css3d-renderer": minor
"@edv4h/usketch-plugin-shape-3d": minor
---

3D の Shape を CSS 3D レンダラーが描くようにしました（3D 標準対応 P4c、#1473）。絵は変わりません。

- **shared**: `shapeClaims(services)` を足しました。3D などで別に描く Shape を、2D のレンダラーが飛ばすための宣言です（`claim(source, ids)`）。shape-3d の `createView3dTracker` / `STAGE_3D_EVENT` もここへ移しました
- **dom-renderer**: `shapeClaims` で宣言された Shape を描きません。`renderer:hide-shapes` イベントも次のメジャーまで聞きます
- **css3d-renderer**: stand / box / float と種別ごとの `render3d` を描く層（`shape-3d`）を持つようになりました。種別の 3D は `ShapeDefinition.view3d`（と `ctx.shapes.configureView3d`）から読むので、shape-3d プラグインが無くても 3D の Shape が立ちます。起伏のある地形の上の平らな Shape を地形の高さに乗せる処理も既定で行います。React と dom-renderer に依存するようになりました
- **shape-3d**: 自分では描かず、種別の表と描画の上限を `css3dShapeSourceService` でレンダラーに渡します。配置の関数（`shapePose` など）と `SHAPE_3D_LAYER_ID` はレンダラーからの再 export として次のメジャーまで残します
