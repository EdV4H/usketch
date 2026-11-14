# @edv4h/usketch-plugin-shape-3d

## 0.4.0

### Minor Changes

- 4a0ff52: 地面と固体の高さを、ボードの高さの窓口（`ctx.height` / `boardHeight`）から読み書きするようにしました（3D 標準対応 P3b、#1469）。今の動きは変わりません。
  
  - **map**: 地形を地面の提供元（優先度 0、`heightEnabled` のときだけ）として登録します。崖は「地面の持ち主が map のとき」だけ描きます
  - **elevation**: 標高を地面の提供元（優先度 `ELEVATION_GROUND_PRIORITY` = 10、場があるときだけ）として登録します。map を包む処理をやめたので、プラグインの並び順によりません。古い map のために `setHeightEnabled` での切り替えは次のメジャーまで続けます
  - **shape-3d**: 当たり判定を固体の提供元として登録し、地面の高さを窓口から読みます
  - **character**: 地面と固体の高さを窓口から読みます
  - `groundHeightService` / `solidHeightService` は窓口が答え続けるので、これらを読む・provide する古いプラグインとも組めます
- 2f8aab7: 3D の Shape を CSS 3D レンダラーが描くようにしました（3D 標準対応 P4c、#1473）。絵は変わりません。
  
  - **shared**: `shapeClaims(services)` を足しました。3D などで別に描く Shape を、2D のレンダラーが飛ばすための宣言です（`claim(source, ids)`）。shape-3d の `createView3dTracker` / `STAGE_3D_EVENT` もここへ移しました
  - **dom-renderer**: `shapeClaims` で宣言された Shape を描きません。`renderer:hide-shapes` イベントも次のメジャーまで聞きます
  - **css3d-renderer**: stand / box / float と種別ごとの `render3d` を描く層（`shape-3d`）を持つようになりました。種別の 3D は `ShapeDefinition.view3d`（と `ctx.shapes.configureView3d`）から読むので、shape-3d プラグインが無くても 3D の Shape が立ちます。起伏のある地形の上の平らな Shape を地形の高さに乗せる処理も既定で行います。React と dom-renderer に依存するようになりました
  - **shape-3d**: 自分では描かず、種別の表と描画の上限を `css3dShapeSourceService` でレンダラーに渡します。配置の関数（`shapePose` など）と `SHAPE_3D_LAYER_ID` はレンダラーからの再 export として次のメジャーまで残します
- cf04198: 3D の Shape の当たり判定（壁・乗れるブロック）をコアに移しました（3D 標準対応 P4b、#1473）。動きは変わりません。
  
  - **shared**: 当たり判定を `shape-solids.ts` に移しました。`createShapeSolids()` は Shape の `view3d` と型ごとの 3D 設定から固体の高さを答えます（`shapeSolidsService`）。`shapeView3dFoot` / `shapeView3dAnchor` も公開します
  - **core**: ボードの Shape の固体を `ctx.height` に登録し、`shapeSolidsService` で提供します。shape-3d プラグインが無くても、`view3d` を持つ Shape にキャラクターがぶつかります
  - **shape-3d**: コアの固体を使い、自分の型の設定と「3D のときだけ当たる」設定を渡すだけになりました。古いコアでは今まで通り自分で登録します。`shape-3d-collision` の export は shared からの再 export として次のメジャーまで残します
- 5916c16: Shape の 3D をコアのデータにしました（3D 標準対応 P4a、#1473）。絵は変わりません。
  
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
- 00a3253: shape-3d を HUD と操作の純関数だけのプラグインにしました（3D 標準対応 P4d、#1473）。
  
  - 操作の純関数を `setShapeView3d` / `clearShapeView3d` / `getShapeView3d` の名前で export します。`setShapeView3d` の種別は表のほか `(type) => ctx.shapes.getView3d?.(type)` のような引き当てでも渡せます。旧名 `setShape3d` / `clearShape3d` / `getShape3d` は次のメジャーまで残します
  - README を、描画は CSS 3D レンダラー・当たり判定はコアという今の分担に合わせて書き直しました

### Patch Changes

- b86508c: 層が 3D 表示での見え方を宣言できるようにし、描画距離をコアの状態にしました（3D 標準対応 P2a、#1466）。絵は変わりません。
  
  - **shared**: `Layer.view3d`（`tilt` / `depth` / `screen` / `hidden`、型 `LayerView3d`）と `SelectionForeground.view3d` を追加。`View3dState.drawDistance`、`view3dOverscanPx`、`LayerRenderContext.view3dOverscan` を追加
  - **canvas-engine**: 層の wrapper に `data-view3d` を付け、3D 表示中は背景を奥まで敷く幅（オーバースキャン）を `view3dOverscan` で各層に渡します。カメラの高さが毎フレーム変わっても、この値が変わらなければ層を描き直しません
  - **mode7**: 描画距離をコアの状態に置きます。`view3d` を宣言した層も傾けます（`tiltLayerIds` を渡したときはその一覧のまま）。`hidden` を宣言した層は 3D の間は出しません
  - **bg-grid / elevation**: オーバースキャンを `view3dOverscan` から読みます（`bg-grid:set-overscan` イベントも次のメジャーまで読みます）
  - **各プラグイン**: Mode 7 が既定で傾けていた層に `view3d` を宣言しました（崖・3D Shape・キャラは `depth`）
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [d7ff62d]
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
  - @edv4h/usketch-css3d-renderer@0.1.0

## 0.3.3

### Patch Changes

- d61f1fc: The 3D layer checks a shape's size and position before sampling the terrain height for `groundFlat`, so shapes off screen or too small to draw no longer call `heightAt` on every frame of a 3D view. On a wide board over an infinite elevation terrain this stops the terrain's generated-chunk cache from being refilled every frame. What is drawn is unchanged.
- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-dom-renderer@2.3.4

## 0.3.2

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0
  - @edv4h/usketch-dom-renderer@2.3.3

## 0.3.1

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0
  - @edv4h/usketch-dom-renderer@2.3.2

## 0.3.0

### Minor Changes

- cdd7248: feat(shape-3d): 3D 表示を持たない Shape も、3D ビューでは地形の高さ（標高・map の段）に平らに乗るように（`limits.groundFlat`、既定オン、HUD で切り替え）

## 0.2.0

### Minor Changes

- 5c1dfe8: 3D shapes can now also be a `box` (the shape lifted as the top of a block, with four walls folded down to the ground in a darker shade of its fill) or `float` (the shape lifted flat into the air with a shadow below), both rising to `height` (world units; defaults 16 / 24) with the Mode 7 transition. `box` is offered for rectangle, rounded-rect, sticky, card, frame and image; other types get stand / float unless the host's `types` says otherwise. The HUD gains the new modes and a height field.
  
  The layout helpers are renamed for all modes: `shapePose` / `ShapePose`, `poseBox`, `poseTransform`, `poseOrigin`, plus `shapeAnchor`, `boxWalls`, `boxTopTransform`, `wallColor` and `wallShade`.
- abc7f44: 3D shapes can now collide with the character. A shape's `x-shape-3d` takes `collision`: `"none"` (default), `"solid"` (a wall) or `"platform"` (a box's top that can be stepped or jumped onto); a stood-up shape blocks along its bottom edge (fixed facing) or at a small disc at its foot (camera facing), a floating one never collides. The shape-3d plugin answers the new shared `solidHeightService` from a grid index of all shapes, and the character combines it with the ground height: walls block (sliding along them), tops are stood on, and moves are checked in short stretches (`sweepToGround`) so a fast move can't skip a thin wall. Collision applies in 2D too unless the new `collisionIn3dOnly` limit is set. Both settings are in the HUD.
- 8c2d0e7: A shape type can now draw its own 3D look: `render3d` in its type config replaces the generic stand / box / float drawing (return `null` to keep the generic one for a shape). The layer places a node of the shape's size at its anchor, lifted to the terrain and turned to the shape's heading, and passes a `Shape3dRenderContext` (transition amount, zoom, node size, the turn that faces the camera, the shape's own drawing, and the live camera with change notifications for canvases such as three.js). Ships `crossRender3d`, which draws a stood-up shape as two crossed planes (a tree / plant sprite). The web community page now stands board portals in Mode 7 by default.

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-dom-renderer@2.3.1

## 0.1.0

### Minor Changes

- df6edda: Shapes can now stand up out of the ground in Mode 7. The new `@edv4h/usketch-plugin-shape-3d` draws shapes holding `x-shape-3d` parameters (`mode: "stand"`, facing the camera or along their bottom edge, on the terrain, with a shadow) folded up in pure CSS 3D while the 3D view is on, and rising / settling with its transition; the flat board, export and editing are unchanged. Set it from the HUD group "3D（選択中の Shape）" or `getShape3dApi(app.services)`.
  
  Supporting pieces: shared gains `view3dService` (how 3D the board is shown, plus the drawn camera), which Mode 7 now provides; Mode 7 tilts the `shape-3d` layer with depth by default; the DOM renderer exports `ShapeContent` and skips shapes named by the `renderer:hide-shapes` event.

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-dom-renderer@2.3.0
