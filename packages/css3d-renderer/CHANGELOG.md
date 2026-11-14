# @edv4h/usketch-css3d-renderer

## 0.1.0

### Minor Changes

- 1884f5a: 3D 表示で、層をまたいで奥行きどおりに重ねる「奥行きステージ」を実験的に追加しました（3D 標準対応 P6a）。既定はオフで、今の見た目は変わりません。
  
  - **shared**: 層の 3D での見え方 `LayerView3d` に `ground`（自分で地面を描く層。傾けず、奥行きで並べるレンダラーでは地面に立つものより奥に置く）を追加しました
  - **css3d-renderer**: `setDepthStage(on)` / `isDepthStage()`、オプション `depthStage` / `hud`、HUD の設定「奥行きで重ねる（実験）」を追加しました。オンにすると、立てた看板の後ろにいるキャラクターが看板に隠れるなど、傾けた層の中身が層の順ではなく実際の奥行きで重なります。純関数 `depthStageRules` も公開します
  - **elevation**: 3D の地形メッシュの層が `view3d: "ground"` を宣言します
- d7ff62d: 3D 表示を描く CSS 3D レンダラーを新しいパッケージに切り出しました（3D 標準対応 P2b、#1466）。絵は変わりません。
  
  - **css3d-renderer（新規）**: ボードの 3D 表示の状態を読み、`view3d` を宣言した層を CSS の 3D 変形で傾けます。`createCss3dRendererPlugin()` を DOM レンダラーの隣に追加します。傾ける層・奥行きを持たせる層は `css3dRendererService` で変えられます
  - **mode7**: 層を傾ける CSS を自分で書かず、レンダラーに傾ける層を伝えるだけになりました。ボードにレンダラーが無ければ自分で 1 つ用意するので、ホストの変更は要りません。`mode7-transform` の `tiltLayerRules` / `drawDistanceClip` / `drawDistanceOverscanPx` と `CAMERA_HEIGHT_VAR` は、レンダラーからの再 export として次のメジャーまで残します
- 2f8aab7: 3D の Shape を CSS 3D レンダラーが描くようにしました（3D 標準対応 P4c、#1473）。絵は変わりません。
  
  - **shared**: `shapeClaims(services)` を足しました。3D などで別に描く Shape を、2D のレンダラーが飛ばすための宣言です（`claim(source, ids)`）。shape-3d の `createView3dTracker` / `STAGE_3D_EVENT` もここへ移しました
  - **dom-renderer**: `shapeClaims` で宣言された Shape を描きません。`renderer:hide-shapes` イベントも次のメジャーまで聞きます
  - **css3d-renderer**: stand / box / float と種別ごとの `render3d` を描く層（`shape-3d`）を持つようになりました。種別の 3D は `ShapeDefinition.view3d`（と `ctx.shapes.configureView3d`）から読むので、shape-3d プラグインが無くても 3D の Shape が立ちます。起伏のある地形の上の平らな Shape を地形の高さに乗せる処理も既定で行います。React と dom-renderer に依存するようになりました
  - **shape-3d**: 自分では描かず、種別の表と描画の上限を `css3dShapeSourceService` でレンダラーに渡します。配置の関数（`shapePose` など）と `SHAPE_3D_LAYER_ID` はレンダラーからの再 export として次のメジャーまで残します
- 1db8c0c: 3D 表示で、丘や崖の陰に入った看板やキャラクターを薄くするようにしました（3D 標準対応 P6b）。これまでは標高の丘の向こうにあるものが丘の手前に描かれていました。
  
  - **shared**: 視点の位置 `cameraEye(view)` と、地面が点を隠すかを調べる `isOccluded(point, view, heightAt)` を追加しました。レンダラーが「地形の陰」を答える `view3dOcclusionService`（`hidden` / `look` / `subscribe`）と `occludedStyle`・`OCCLUDED_OPACITY` も追加しました
  - **css3d-renderer**: `view3dOcclusionService` を出し、3D の Shape は上端が陰に入ると薄くします（箱は面ごと、自前の 3D 表現は隠す）。オプション `occlusion`（`"fade"` 既定 / `"hide"` / `"none"`）、`setOcclusion` / `getOcclusion`、HUD の「地形の陰」を追加しました。答えは 100ms 使い回し、1 フレームで調べ直すのは 40 個までです
  - **character**: 体の中ほどが陰に入ると、描き手に `occluded`（`"fade"` / `"hide"`）を渡します。`"hide"` のときはプラグインが隠し、影も一緒に薄く／隠します
- 458decc: 3D 表示を WebGL2 で描く GPU レンダラーを、実験として追加しました（3D 標準対応 P6g-1、#1304）。既定の描画（CSS 3D）は変わりません。
  
  - **gpu3d-renderer（新規・実験中）**: CSS 3D レンダラーの代わりに追加すると、地面（背景色とグリッド）と GPU で描くプラグインの絵を、深度バッファ付きの 1 枚のキャンバスに描きます。この版では Shape やキャラはまだ描きません
  - **shared**: どの 3D レンダラーでも同じ形で取れる `view3dRendererService`（`View3dRendererApi`）と、プラグインが GPU レンダラーのキャンバスに描くための描画フック `view3dGl` / `view3dGlService`（`View3dGlApi`・`View3dGlDrawable`）、深度の揃え方 `VIEW3D_DEPTH_GLSL` / `VIEW3D_DEPTH_RANGE_PX` を追加しました
  - **css3d-renderer**: `view3dRendererService` も提供します（`Css3dRendererApi` はその拡張）。もう 3D レンダラーがあるボードでは何もしません
  - **mode7**: 3D レンダラーを `view3dRendererService` から取ります（無ければ従来どおり CSS 3D レンダラーを探し、それも無ければ自分で用意）
  - **elevation**: GPU レンダラーが描いている間は、地形のメッシュを自分のキャンバスではなく GPU レンダラーのキャンバスに描きます

### Patch Changes

- d0635ab: 3D の Shape を GPU 3D レンダラー（実験中）でも立てて描くようになりました（3D 標準対応 P6g-2b、#1304）。CSS 3D の絵は変わりません。
  
  - **shared**: どの Shape をどう 3D で描くかの決め方を、2 つの 3D レンダラーで共通にしました。`selectView3dShapes` / `View3dShapeLimits` / `DEFAULT_VIEW3D_SHAPE_LIMITS` / `sanitizeView3dShapeLimits` / `GROUND_FLAT_VIEW3D` / `view3dShapeSourceService`（キーは css3d-renderer のまま）/ `declaredView3dShapeTypes` / `view3dShapeHeading` / `view3dShapeWallColor` / `lerpAngle` を追加
  - **css3d-renderer**: 上を使うようにしました。`selectShapes3d` / `Css3dShapeLimits` / `DEFAULT_CSS3D_SHAPE_LIMITS` / `GROUND_FLAT_PARAMS` / `css3dShapeSourceService` / `sanitizeCss3dShapeLimits` / `lerpAngle` / `wallColor` は shared の同じものの別名として残ります
  - **gpu3d-renderer**: 立てる・箱・浮かせるの Shape を、CSS 3D レンダラーと同じ位置・向き・高さで描きます。深度を持つので、地形や他の 3D の Shape と前後で隠し合います。影も描きます
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [711ee35]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0
  - @edv4h/usketch-dom-renderer@2.4.0
