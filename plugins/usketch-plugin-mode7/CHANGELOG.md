# @edv4h/usketch-plugin-mode7

## 0.8.0

### Minor Changes

- d7ff62d: 3D 表示を描く CSS 3D レンダラーを新しいパッケージに切り出しました（3D 標準対応 P2b、#1466）。絵は変わりません。
  
  - **css3d-renderer（新規）**: ボードの 3D 表示の状態を読み、`view3d` を宣言した層を CSS の 3D 変形で傾けます。`createCss3dRendererPlugin()` を DOM レンダラーの隣に追加します。傾ける層・奥行きを持たせる層は `css3dRendererService` で変えられます
  - **mode7**: 層を傾ける CSS を自分で書かず、レンダラーに傾ける層を伝えるだけになりました。ボードにレンダラーが無ければ自分で 1 つ用意するので、ホストの変更は要りません。`mode7-transform` の `tiltLayerRules` / `drawDistanceClip` / `drawDistanceOverscanPx` と `CAMERA_HEIGHT_VAR` は、レンダラーからの再 export として次のメジャーまで残します
- 458decc: 3D 表示を WebGL2 で描く GPU レンダラーを、実験として追加しました（3D 標準対応 P6g-1、#1304）。既定の描画（CSS 3D）は変わりません。
  
  - **gpu3d-renderer（新規・実験中）**: CSS 3D レンダラーの代わりに追加すると、地面（背景色とグリッド）と GPU で描くプラグインの絵を、深度バッファ付きの 1 枚のキャンバスに描きます。この版では Shape やキャラはまだ描きません
  - **shared**: どの 3D レンダラーでも同じ形で取れる `view3dRendererService`（`View3dRendererApi`）と、プラグインが GPU レンダラーのキャンバスに描くための描画フック `view3dGl` / `view3dGlService`（`View3dGlApi`・`View3dGlDrawable`）、深度の揃え方 `VIEW3D_DEPTH_GLSL` / `VIEW3D_DEPTH_RANGE_PX` を追加しました
  - **css3d-renderer**: `view3dRendererService` も提供します（`Css3dRendererApi` はその拡張）。もう 3D レンダラーがあるボードでは何もしません
  - **mode7**: 3D レンダラーを `view3dRendererService` から取ります（無ければ従来どおり CSS 3D レンダラーを探し、それも無ければ自分で用意）
  - **elevation**: GPU レンダラーが描いている間は、地形のメッシュを自分のキャンバスではなく GPU レンダラーのキャンバスに描きます
- b86508c: 層が 3D 表示での見え方を宣言できるようにし、描画距離をコアの状態にしました（3D 標準対応 P2a、#1466）。絵は変わりません。
  
  - **shared**: `Layer.view3d`（`tilt` / `depth` / `screen` / `hidden`、型 `LayerView3d`）と `SelectionForeground.view3d` を追加。`View3dState.drawDistance`、`view3dOverscanPx`、`LayerRenderContext.view3dOverscan` を追加
  - **canvas-engine**: 層の wrapper に `data-view3d` を付け、3D 表示中は背景を奥まで敷く幅（オーバースキャン）を `view3dOverscan` で各層に渡します。カメラの高さが毎フレーム変わっても、この値が変わらなければ層を描き直しません
  - **mode7**: 描画距離をコアの状態に置きます。`view3d` を宣言した層も傾けます（`tiltLayerIds` を渡したときはその一覧のまま）。`hidden` を宣言した層は 3D の間は出しません
  - **bg-grid / elevation**: オーバースキャンを `view3dOverscan` から読みます（`bg-grid:set-overscan` イベントも次のメジャーまで読みます）
  - **各プラグイン**: Mode 7 が既定で傾けていた層に `view3d` を宣言しました（崖・3D Shape・キャラは `depth`）
- b41ea96: 3D 表示の状態（カメラと 3D の度合い）をコアの状態にしました（3D 標準対応 P1、#1304）。
  
  - **shared**: `Camera3d`（pitch / fov / horizon / height）と `View3dState`（camera ＋ amount）、範囲 `CAMERA_3D_LIMITS`、`createView3dCell` / `view3dCellOf` を追加。`BoardStore` に `getView3d` / `setView3d` / `subscribeView3d` を追加（次のメジャーまでは省略可）。`View3dApi` に `turn()`（3D 表示が viewport を回した角度）を追加
  - **store**: `createBoardStore` が 3D 表示の状態を持ちます。viewport と同じく見る人ごとで同期しません。通知は `subscribe` とは別です
  - **mode7**: カメラと遷移量をコアの状態に置きます。yaw は傾ける層を回すのをやめ、3D の間は viewport の回転（`Viewport.rotation`）として地平線の中央を軸に回し、平らに戻るときに回した分だけ戻します。絵は変わりません。`getRenderedCamera()` と `view3dService` の `camera().yaw` は常に `0` になります
  - **character**: 追従カメラが 3D 表示の回転（`turn()`）を足して追従するので、3D 中に yaw を変えても追従が止まらず、yaw が保たれます

### Patch Changes

- 4846cdc: 3D 表示の投影をコアの 1 か所にまとめた（3D 標準対応の P1、#1304）:
  
  - shared: Mode 7 の投影の純関数を追加。`projectStagePoint` / `unprojectStagePoint`（傾ける前の画面の px）、`projectWorld` / `unprojectWorld`（world 座標と高さ）、凹凸のある地面でポインターの下の地点を探す `unprojectOnGround`、層の CSS の `tiltCss`、シェーダー用の 4×4 行列 `viewMatrix`（タイルの角などを原点にでき、遠くの座標でも float32 の精度を落とさない）。
  - mode7: `projectToGround` / `unprojectFromGround` / `tiltOrigin` / `tiltTransform` は shared の関数を使うようにした（名前と結果は同じ）。
  - elevation: Mode 7 のメッシュの頂点シェーダーを shared の `viewMatrix` に置き換え、`projectLifted` も shared の関数を使うようにした（絵は同じ）。
- 7b1ec3c: Plugins can add their own handles to the select tool. `ctx.ui.selectionHandles` (`SelectionHandleProvider`, `app.selectionHandles`) takes a provider that lists handles for the current selection / hover, draws them, and runs a drag when one is pressed. The select tool hit-tests them after its own rotation / resize handles (which always win; a handle sitting on one is not shown), draws them in one layer above the selection frame (`SELECT_TOOL_LAYER_IDS.handles`, order 81), sets their cursor through its own cursor override, passes them its overlay colors, and hides them while it moves, resizes or rotates shapes or draws a marquee. A press on a handle that does nothing selects the handle's shape.
  
  The connector's end handles and anchor dots now use it (`CONNECTOR_HANDLE_IDS`), instead of their own layers. This fixes: a dot drawn on top of a resize handle stealing the press; a click on a hovered shape's edge dot doing nothing; the shape under the pointer showing its dots during an end drag; handles drawn in a fixed blue instead of the selection color; and drag state shared between two boards on one page. The `connector-endpoints` and `connector-anchor-handles` layers are gone (`CONNECTOR_LAYER_IDS.endpoints` / `.anchorHandles` are deprecated); to turn the dots off at runtime, use `app.selectionHandles.unregister(CONNECTOR_HANDLE_IDS.anchors)`. The handles need a select tool from this release.
  
  mode7 tilts the new handles layer with the board.
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
  - @edv4h/usketch-store@3.12.0

## 0.7.0

### Minor Changes

- 6db00b3: Character, Mode 7 and window-system keys are now keymap bindings (`ctx.keymap`), so overlaps with other plugins show up in `keymap.getConflicts()` and hosts can set them with `createApp({ keymap: { keys } })`.
  
  - Character: the movement, drift and jump keys are `"hold"` bindings (`CHARACTER_KEY_IDS`, e.g. `usketch-plugin-character:jump`), with the plugin's `keys` as defaults. While the character is on they sit above tool shortcuts and Mode 7's camera height keys (`CHARACTER_KEY_PRIORITY`: movement, then drift, then jump), and a key the keymap gives to someone else is left alone. `setKeys` / `resetKeys` / `getDefaultKeys` / `onKeysChange` now go through the keymap (a viewer's saved keys are applied on top of the host's), so rebinding in the keymap updates the HUD's key settings too.
  - Mode 7: the camera height keys are `"hold"` bindings `HEIGHT_KEY_IDS` (`usketch-plugin-mode7:camera-up` / `camera-down`, priority `HEIGHT_KEY_PRIORITY` = 10) that only count while the 3D view is on and no follower drives the height. `getHeightKeys` / `setHeightKeys` are deprecated wrappers. Every action is a binding `usketch-plugin-mode7:<action>` (no keys by default); the `shortcuts` option is deprecated.
  - Window system: every action is a binding `usketch-plugin-window-system:<action>`, taking its keys (default `Alt+Arrow` / `Alt+Shift+Arrow`) only on a window board; the `shortcuts` option is deprecated.
  
  Hosts without a keymap (older `@edv4h/usketch-core`) keep the previous behaviour.

### Patch Changes

- 3fe3def: fix(mode7): キャラ追従などが `view3dService.setCameraHeight` でカメラの高さを動かしている間は、高さキー（Space / Shift）で高さを変えない。両方が毎フレーム高さを書き換えて画面がガタガタしていた。
- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-store@3.11.6

## 0.6.1

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0
  - @edv4h/usketch-store@3.11.5

## 0.6.0

### Minor Changes

- 9ffa649: Raise the 3D view's camera with the ground. Mode 7's `Camera` gets `height` (world units, default 0; `setHeight`): everything is drawn that much lower, so ground at that height shows where the flat board would. Hold Space / Shift in the 3D view to move the camera up / down (`heightKeys`, `heightSpeed`, rebindable via `setHeightKeys`). In shared, `View3dCamera.heightPx` and the optional `View3dApi.setCameraHeight` carry it; `getRenderedCamera().heightPx`, `projectToGround` / `unprojectFromGround` (now with a `z`) and the elevation mesh honor it. The character's follow camera sets it to the ground under the feet (eased), so walking up a high mountain no longer leaves the view.

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0
  - @edv4h/usketch-store@3.11.4

## 0.5.2

### Patch Changes

- 890d909: feat(elevation): Mode 7 の 3D ビューで標高を WebGL のメッシュとして描き、地面が本当に盛り上がるように。mode7 の `projectToGround` は任意の高さ `z` を受け取れるように（後方互換）
- 2af113c: 標高プラグインを追加した。ボードの地面に場所ごとの高さを持たせ、シードから無限の起伏を生成する（起伏そのものは同期せず、各クライアントが同じ値を計算する）。2D では高さの色分け・陰影・等高線で描き、`groundHeightService` を提供するのでキャラは坂を上下する。ブラシの差分はチャンクごとの Shape（約 3 KB）に持つ。map には高さを止める `setHeightEnabled` / `renderConfig.heightEnabled` を足し、標高の場があるボードでは map は色だけの平らな地図になる。Mode 7 の既定の tilt 層に `usketch-elevation:ground` を足した。

## 0.5.1

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-store@3.11.3

## 0.5.0

### Minor Changes

- df6edda: Shapes can now stand up out of the ground in Mode 7. The new `@edv4h/usketch-plugin-shape-3d` draws shapes holding `x-shape-3d` parameters (`mode: "stand"`, facing the camera or along their bottom edge, on the terrain, with a shadow) folded up in pure CSS 3D while the 3D view is on, and rising / settling with its transition; the flat board, export and editing are unchanged. Set it from the HUD group "3D（選択中の Shape）" or `getShape3dApi(app.services)`.
  
  Supporting pieces: shared gains `view3dService` (how 3D the board is shown, plus the drawn camera), which Mode 7 now provides; Mode 7 tilts the `shape-3d` layer with depth by default; the DOM renderer exports `ShapeContent` and skips shapes named by the `renderer:hide-shapes` event.

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-store@3.11.2

## 0.4.3

### Patch Changes

- Updated dependencies [ca67108]
  - @edv4h/usketch-store@3.11.1

## 0.4.2

### Patch Changes

- c7e886c: Mode 7 no longer re-applies the tilt on every pan: the stylesheet is rebuilt only when the zoom, window size, camera or tilted layers change, and an unchanged stylesheet is not rewritten. Walking a character (the camera follows it every frame) no longer restyles the whole stage each frame.
- Updated dependencies [33a4ef2]
- Updated dependencies [157cce0]
  - @edv4h/usketch-store@3.11.0

## 0.4.1

### Patch Changes

- 2d972ec: マップ上をキャラで歩いたときの重さを改善する。地形は 16 マス単位のチャンクで描いてメモ化し、移動はラッパーの translate だけにする（キャラなど他の図形が動いても作り直さない）。段差（立体）は Mode 7 が `usketch:stage-3d` で 3D 表示中を知らせたときだけ組み立て、同じ高さ・地形が続く崖の面を 1 枚にまとめる。手描き風のゆらぎは feTurbulence をやめ、一度だけ作るタイル状のノイズ画像に置き換え、かかる範囲を画面内に絞る。カメラ回転中の描画範囲は角度に依存しない正方形にする。
- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
- Updated dependencies [6f3ef3b]
- Updated dependencies [9b3a0a1]
  - @edv4h/usketch-shared@4.19.0
  - @edv4h/usketch-store@3.10.0

## 0.4.0

### Minor Changes

- d099a8d: character: vehicle drift (opt-in `drift` option: hold Space and steer at speed) and the held steering, body slip and drift state on the pose, render props and awareness. `CharacterPose` gains `steering` / `slip` / `drift`, and `parseWireState` now returns the full remote shape (`Omit<RemoteCharacter, "id">`, vehicle fields filled in). mode7: `projectToGround` / `unprojectFromGround` / `tiltOrigin` point math, `transitionCamera` export and `getRenderedCamera()` on the service.
- 8cb3482: map のセルに高さを追加。地形タイプから段（水 0 / 陸 1 / 岩 2 / 山 3 / 雪 4）を自動で決め、Mode 7 では段差を崖として立体表示する。キャラクターは「登れる段差」より高い崖を登れない（降りるのは自由）。高さは共有の `groundHeightService` で公開し、`getMapApi().getHeightAt()` でも取得できる。

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0
  - @edv4h/usketch-store@3.9.2

## 0.3.4

### Patch Changes

- cbfbf92: 島（`@edv4h/usketch-plugin-shape-island`）プラグインを削除したのに合わせ、mode7 の既定の傾けるレイヤーから `island-metaball` を外し、DOM レンダラーが `island` をコンテナ扱いする固定リストからも外す。

## 0.3.3

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0
  - @edv4h/usketch-store@3.9.1

## 0.3.2

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0
  - @edv4h/usketch-store@3.9.0

## 0.3.1

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0
  - @edv4h/usketch-store@3.8.1

## 0.3.0

### Minor Changes

- c153006: Animated enable/disable transition (#1103). With `transition: { durationMs, easing }`
  the ground rises from flat to `camera.pitch` (and yaw) while the sky/fog fade in, and
  the reverse on exit — the view stays active until the board is flat again. Toggling
  mid-transition reverses from the current state; `prefers-reduced-motion` skips to the
  end. Per call: `enable/disable/toggle({ animate })`. New `isTransitioning()` and
  `getTransitionAmount()`; `onChange` fires every frame of a transition. Default
  `durationMs: 0` keeps the instant switch.

## 0.2.1

### Patch Changes

- 749fd70: Tilt the `character` layer (usketch-plugin-character) by default, so controllable
  characters walk on the 3D ground plane.
- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0
  - @edv4h/usketch-store@3.8.0

## 0.2.0

### Minor Changes

- b133c5f: feat(mode7): ファミコン Mode 7 風に Canvas を擬似3D地平面ビューで見るプラグインを追加

  `@edv4h/usketch-plugin-mode7` を新規追加。実際の Shape をそのまま「奥へ傾く地平面」に見せる
  ビューモード（編集ではなく閲覧）。ON/OFF トグル、既定 OFF。
  - **CSS 3D 変換を板コンテンツ層のラッパに注入**（`perspective()+rotateX(pitch)+rotateZ(yaw)`）。
    `data-layer-id` で識別できる外側ラッパ（React 非管理の transform）に当てるので再レンダで消えない。
    対象は allow 方式（既定 `dom-shapes`/`gpu-shapes`/`bg-grid`/`bg-dots`/`island-metaball`、options で増減可）
    なので HUD/選択ハンドル等の UI 層は傾かない。
  - **sky / fog / capture の3オーバーレイ層**（傾けない）。capture 層が板ポインタを捕捉して
    3D 下での編集破綻を防ぎ、ドラッグ=地上移動(viewport pan)・wheel=ズームでカメラを操作。
  - カメラ（pitch/yaw/fov/horizon）と見た目（空色/フォグ）を **HUD＋アクション＋サービス API** で設定。
    アクションは `mode7:<action>` emit でも起動可（`toggle`/`pitch-*`/`yaw-*`/`fov-*`/`reset`）。
    ショートカットは opt-in（`event.key` 照合の layout 依存を避け既定なし、`shortcuts` で割当）。
  - 状態はビュー限定（per-viewer・非永続・非同期）＝ shape 化しない（presentation と同類）。
  - `createMode7Plugin({ enabledInitially, camera, look, tiltLayerIds, shortcuts })`。
  - 純関数（camera/transform）ユニットテスト 20 件。
