# @edv4h/usketch-plugin-elevation

## 0.5.0

### Minor Changes

- 4a0ff52: 地面と固体の高さを、ボードの高さの窓口（`ctx.height` / `boardHeight`）から読み書きするようにしました（3D 標準対応 P3b、#1469）。今の動きは変わりません。
  
  - **map**: 地形を地面の提供元（優先度 0、`heightEnabled` のときだけ）として登録します。崖は「地面の持ち主が map のとき」だけ描きます
  - **elevation**: 標高を地面の提供元（優先度 `ELEVATION_GROUND_PRIORITY` = 10、場があるときだけ）として登録します。map を包む処理をやめたので、プラグインの並び順によりません。古い map のために `setHeightEnabled` での切り替えは次のメジャーまで続けます
  - **shape-3d**: 当たり判定を固体の提供元として登録し、地面の高さを窓口から読みます
  - **character**: 地面と固体の高さを窓口から読みます
  - `groundHeightService` / `solidHeightService` は窓口が答え続けるので、これらを読む・provide する古いプラグインとも組めます
- 1884f5a: 3D 表示で、層をまたいで奥行きどおりに重ねる「奥行きステージ」を実験的に追加しました（3D 標準対応 P6a）。既定はオフで、今の見た目は変わりません。
  
  - **shared**: 層の 3D での見え方 `LayerView3d` に `ground`（自分で地面を描く層。傾けず、奥行きで並べるレンダラーでは地面に立つものより奥に置く）を追加しました
  - **css3d-renderer**: `setDepthStage(on)` / `isDepthStage()`、オプション `depthStage` / `hud`、HUD の設定「奥行きで重ねる（実験）」を追加しました。オンにすると、立てた看板の後ろにいるキャラクターが看板に隠れるなど、傾けた層の中身が層の順ではなく実際の奥行きで重なります。純関数 `depthStageRules` も公開します
  - **elevation**: 3D の地形メッシュの層が `view3d: "ground"` を宣言します
- a7ff08e: Add `gradeElevation(deps, path, opts)` (also `getElevationApi().grade`) to level a strip of ground along a path in one undo step, e.g. under a road or race track drawn over hills: flat across `halfWidth`, following the ground under the path averaged over `smoothing` (or at one `height`) along it, and blending into the terrain over a `shoulder`. `closed` wraps the averaging around a loop. Does nothing on a board without an elevation field. Also exports the pure pieces (`applyGrade`, `gradeProfile`, `resamplePath`) and `strokeEditor`, the grid read/write access the brush now uses.
- 458decc: 3D 表示を WebGL2 で描く GPU レンダラーを、実験として追加しました（3D 標準対応 P6g-1、#1304）。既定の描画（CSS 3D）は変わりません。
  
  - **gpu3d-renderer（新規・実験中）**: CSS 3D レンダラーの代わりに追加すると、地面（背景色とグリッド）と GPU で描くプラグインの絵を、深度バッファ付きの 1 枚のキャンバスに描きます。この版では Shape やキャラはまだ描きません
  - **shared**: どの 3D レンダラーでも同じ形で取れる `view3dRendererService`（`View3dRendererApi`）と、プラグインが GPU レンダラーのキャンバスに描くための描画フック `view3dGl` / `view3dGlService`（`View3dGlApi`・`View3dGlDrawable`）、深度の揃え方 `VIEW3D_DEPTH_GLSL` / `VIEW3D_DEPTH_RANGE_PX` を追加しました
  - **css3d-renderer**: `view3dRendererService` も提供します（`Css3dRendererApi` はその拡張）。もう 3D レンダラーがあるボードでは何もしません
  - **mode7**: 3D レンダラーを `view3dRendererService` から取ります（無ければ従来どおり CSS 3D レンダラーを探し、それも無ければ自分で用意）
  - **elevation**: GPU レンダラーが描いている間は、地形のメッシュを自分のキャンバスではなく GPU レンダラーのキャンバスに描きます

### Patch Changes

- b86508c: 層が 3D 表示での見え方を宣言できるようにし、描画距離をコアの状態にしました（3D 標準対応 P2a、#1466）。絵は変わりません。
  
  - **shared**: `Layer.view3d`（`tilt` / `depth` / `screen` / `hidden`、型 `LayerView3d`）と `SelectionForeground.view3d` を追加。`View3dState.drawDistance`、`view3dOverscanPx`、`LayerRenderContext.view3dOverscan` を追加
  - **canvas-engine**: 層の wrapper に `data-view3d` を付け、3D 表示中は背景を奥まで敷く幅（オーバースキャン）を `view3dOverscan` で各層に渡します。カメラの高さが毎フレーム変わっても、この値が変わらなければ層を描き直しません
  - **mode7**: 描画距離をコアの状態に置きます。`view3d` を宣言した層も傾けます（`tiltLayerIds` を渡したときはその一覧のまま）。`hidden` を宣言した層は 3D の間は出しません
  - **bg-grid / elevation**: オーバースキャンを `view3dOverscan` から読みます（`bg-grid:set-overscan` イベントも次のメジャーまで読みます）
  - **各プラグイン**: Mode 7 が既定で傾けていた層に `view3d` を宣言しました（崖・3D Shape・キャラは `depth`）
- 4846cdc: 3D 表示の投影をコアの 1 か所にまとめた（3D 標準対応の P1、#1304）:
  
  - shared: Mode 7 の投影の純関数を追加。`projectStagePoint` / `unprojectStagePoint`（傾ける前の画面の px）、`projectWorld` / `unprojectWorld`（world 座標と高さ）、凹凸のある地面でポインターの下の地点を探す `unprojectOnGround`、層の CSS の `tiltCss`、シェーダー用の 4×4 行列 `viewMatrix`（タイルの角などを原点にでき、遠くの座標でも float32 の精度を落とさない）。
  - mode7: `projectToGround` / `unprojectFromGround` / `tiltOrigin` / `tiltTransform` は shared の関数を使うようにした（名前と結果は同じ）。
  - elevation: Mode 7 のメッシュの頂点シェーダーを shared の `viewMatrix` に置き換え、`projectLifted` も shared の関数を使うようにした（絵は同じ）。
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
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

## 0.4.1

### Patch Changes

- 96b1560: `tileRevision` is remembered per elevation model (models are replaced, never mutated, when the heights change), so the 3D mesh layer no longer rebuilds every visible tile's revision key on every frame of a 3D view, and the flat ground layer no longer does it on every re-render while the camera moves. Zoomed out over a brushed terrain this was up to ~1.4 ms per frame. What is drawn is unchanged.
- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0

## 0.4.0

### Minor Changes

- 55459fd: Paint ground decals (shared's `groundDecals`) onto the terrain. Under a 3D view the mesh maps them onto the raised surface as a texture per tile, so a course follows every slope, is shaded like the ground and hides behind hills. The flat ground lays a decal canvas over each tile. Texture size follows how big the tile shows on screen (64 to 1024 px, mipmapped), only tiles with decals get one, and repaints are budgeted per frame. The helpers `decalTilePx`, `projectedTilePx`, `paintDecalTile`, `decalTexMapping` and `tileWorldRect` are exported.

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0

## 0.3.0

### Minor Changes

- 9ffa649: Raise the 3D view's camera with the ground. Mode 7's `Camera` gets `height` (world units, default 0; `setHeight`): everything is drawn that much lower, so ground at that height shows where the flat board would. Hold Space / Shift in the 3D view to move the camera up / down (`heightKeys`, `heightSpeed`, rebindable via `setHeightKeys`). In shared, `View3dCamera.heightPx` and the optional `View3dApi.setCameraHeight` carry it; `getRenderedCamera().heightPx`, `projectToGround` / `unprojectFromGround` (now with a `z`) and the elevation mesh honor it. The character's follow camera sets it to the ground under the feet (eased), so walking up a high mountain no longer leaves the view.

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0

## 0.2.0

### Minor Changes

- 640f50e: feat(elevation): 2D の層とメッシュの層の重なり順を `groundOrder` / `meshOrder` で変えられるように（既定は今まで通り 45 / 46）。map の拠点の範囲やアイコンなど、ほかの地面の層を標高の上に出したいホスト向け。有限の数でない値は既定に戻す

## 0.1.0

### Minor Changes

- cf85e56: feat(elevation): 標高ブラシ（盛る・削る・ならす・平らにする・段にする）。ドラッグ中は手元で描き、離したときに変わったチャンクだけを 1 回の undo として書く
- 890d909: feat(elevation): Mode 7 の 3D ビューで標高を WebGL のメッシュとして描き、地面が本当に盛り上がるように。mode7 の `projectToGround` は任意の高さ `z` を受け取れるように（後方互換）
- 2af113c: 標高プラグインを追加した。ボードの地面に場所ごとの高さを持たせ、シードから無限の起伏を生成する（起伏そのものは同期せず、各クライアントが同じ値を計算する）。2D では高さの色分け・陰影・等高線で描き、`groundHeightService` を提供するのでキャラは坂を上下する。ブラシの差分はチャンクごとの Shape（約 3 KB）に持つ。map には高さを止める `setHeightEnabled` / `renderConfig.heightEnabled` を足し、標高の場があるボードでは map は色だけの平らな地図になる。Mode 7 の既定の tilt 層に `usketch-elevation:ground` を足した。
