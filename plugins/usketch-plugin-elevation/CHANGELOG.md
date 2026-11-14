# @edv4h/usketch-plugin-elevation

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
