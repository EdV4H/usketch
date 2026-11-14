# @edv4h/usketch-plugin-character

## 0.12.0

### Minor Changes

- 4a0ff52: 地面と固体の高さを、ボードの高さの窓口（`ctx.height` / `boardHeight`）から読み書きするようにしました（3D 標準対応 P3b、#1469）。今の動きは変わりません。
  
  - **map**: 地形を地面の提供元（優先度 0、`heightEnabled` のときだけ）として登録します。崖は「地面の持ち主が map のとき」だけ描きます
  - **elevation**: 標高を地面の提供元（優先度 `ELEVATION_GROUND_PRIORITY` = 10、場があるときだけ）として登録します。map を包む処理をやめたので、プラグインの並び順によりません。古い map のために `setHeightEnabled` での切り替えは次のメジャーまで続けます
  - **shape-3d**: 当たり判定を固体の提供元として登録し、地面の高さを窓口から読みます
  - **character**: 地面と固体の高さを窓口から読みます
  - `groundHeightService` / `solidHeightService` は窓口が答え続けるので、これらを読む・provide する古いプラグインとも組めます
- 1db8c0c: 3D 表示で、丘や崖の陰に入った看板やキャラクターを薄くするようにしました（3D 標準対応 P6b）。これまでは標高の丘の向こうにあるものが丘の手前に描かれていました。
  
  - **shared**: 視点の位置 `cameraEye(view)` と、地面が点を隠すかを調べる `isOccluded(point, view, heightAt)` を追加しました。レンダラーが「地形の陰」を答える `view3dOcclusionService`（`hidden` / `look` / `subscribe`）と `occludedStyle`・`OCCLUDED_OPACITY` も追加しました
  - **css3d-renderer**: `view3dOcclusionService` を出し、3D の Shape は上端が陰に入ると薄くします（箱は面ごと、自前の 3D 表現は隠す）。オプション `occlusion`（`"fade"` 既定 / `"hide"` / `"none"`）、`setOcclusion` / `getOcclusion`、HUD の「地形の陰」を追加しました。答えは 100ms 使い回し、1 フレームで調べ直すのは 40 個までです
  - **character**: 体の中ほどが陰に入ると、描き手に `occluded`（`"fade"` / `"hide"`）を渡します。`"hide"` のときはプラグインが隠し、影も一緒に薄く／隠します
- 34232b1: 追従カメラをコア（shared）に置きました（3D 標準対応 P5、#1478）。動きは変わりません。
  
  - **shared**: `follow-view` を足しました。動くものを画面の決まった位置に置き続け（`fixed` / 向きに合わせて回す `rotate`）、3D 表示中はカメラの高さを足元の地面に合わせます。自分でフレームを回す呼び手向けの `createFollowView({ store, services })`（`step` / `reset` / `releaseHeight` / `onPan` / `viewTurn`）と、目標だけ渡せば自分のループで追う `followView(board, target, options)` があります。計算は純関数（`followRotation` / `easeFollowFocus` / `followCameraHeight` / `followViewport` / `smoothingAlpha` ほか）でも使えます
  - **character**: 追従カメラを shared の `createFollowView` で動かすようになりました。`character-camera` の export（`targetRotation` / `easeFocus` / `CameraFocus` など）は次のメジャーまで残します

### Patch Changes

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

## 0.11.0

### Minor Changes

- 312c835: feat(character): 空中制御を追加。`jump.airControl`（0〜1、既定 0.5、HUD「空中制御」）で、空中では跳んだ勢い（`pose.moveVx` / `moveVy`）が残り、方向移動はキーの方向へ少しずつ寄せられ、車は地上の `airControl` 倍で曲がれる（スロットル・ブレーキは効かない）。0 = 弾道どおり、1 = 地上と同じ。描画用に `controlScheme` を render props に追加し、awareness でも送る（古いクライアントは `"directional"`）。
  
  車は空中でドリフトキーを押している間、車体を傾けられる: 前後キーでピッチ（前 = 機首下げ）、左右でロール（`jump.spinRate`、既定 270°/秒、0 = なし）。着地時に地面とのズレが `jump.landingTolerance`（既定 35°）を超えると速度が `jump.crashSpeed`（既定 0.3）倍に落ちる。姿勢は `pose.pitch` / `roll`・render props・awareness に載る。回転には慣性がある（`jump.spinInertia`、既定 0.3 秒、0 = なし）: 回り始めがその時間で全速になり、キーを離しても同じ時間かけて止まる。
- ad6e37b: On the flat (2D) board a jump now lifts the character up the screen and grows it a little while its shadow stays at the feet (`motion.flatLift`, HUD "ジャンプで画面上に浮かせる（2D）"). The look fades out as the view turns 3D, where the body rises for real. Renderers get a new `depth` prop (0 = flat … 1 = 3D).
- 7b1fd52: Add a "キー設定" HUD panel: rebind every action (up / down / left / right / jump / drift, up to two keys each) by clicking a key and pressing the new one, with conflicts moved over, unbound directions flagged and "既定に戻す". Bindings are saved per viewer in localStorage (`saveKeys: false` to opt out). The old "ドリフトのキー" / "ジャンプのキー" HUD fields are folded into the panel. New API: `setKeys(keys, { save })`, `getDefaultKeys`, `resetKeys`, `onKeysChange`, `captureNextKey`; pure helpers in `character-keys`.
- 6db00b3: Character, Mode 7 and window-system keys are now keymap bindings (`ctx.keymap`), so overlaps with other plugins show up in `keymap.getConflicts()` and hosts can set them with `createApp({ keymap: { keys } })`.
  
  - Character: the movement, drift and jump keys are `"hold"` bindings (`CHARACTER_KEY_IDS`, e.g. `usketch-plugin-character:jump`), with the plugin's `keys` as defaults. While the character is on they sit above tool shortcuts and Mode 7's camera height keys (`CHARACTER_KEY_PRIORITY`: movement, then drift, then jump), and a key the keymap gives to someone else is left alone. `setKeys` / `resetKeys` / `getDefaultKeys` / `onKeysChange` now go through the keymap (a viewer's saved keys are applied on top of the host's), so rebinding in the keymap updates the HUD's key settings too.
  - Mode 7: the camera height keys are `"hold"` bindings `HEIGHT_KEY_IDS` (`usketch-plugin-mode7:camera-up` / `camera-down`, priority `HEIGHT_KEY_PRIORITY` = 10) that only count while the 3D view is on and no follower drives the height. `getHeightKeys` / `setHeightKeys` are deprecated wrappers. Every action is a binding `usketch-plugin-mode7:<action>` (no keys by default); the `shortcuts` option is deprecated.
  - Window system: every action is a binding `usketch-plugin-window-system:<action>`, taking its keys (default `Alt+Arrow` / `Alt+Shift+Arrow`) only on a window board; the `shortcuts` option is deprecated.
  
  Hosts without a keymap (older `@edv4h/usketch-core`) keep the previous behaviour.
- 5adf284: New `@edv4h/usketch-plugin-key-settings`: one HUD "キー設定" panel for every plugin's key bindings (the app's keymap). Bindings are grouped by category (or plugin) with a filter; click a key and press the new one (Esc cancels, Delete / Backspace removes it, "+" adds one). Keys another plugin also uses are marked ⚠ and kept (the keymap's conflict policy decides between them); a key one of the same plugin's other actions had moves over. While picking, the keymap gate blocks every binding. Reset per binding or all at once. The viewer's rebindings are saved through a `KeymapStorage` (default localStorage `"usketch:keymap"`; `storage: false` leaves it to the host). The rules are exported as pure functions (`groupBindings`, `applyPickedKey`, `sharersOf`, `captureKeys`).
  
  Character: its own "キー設定" HUD panel is removed in favour of the shared one. Keys a viewer saved with it (`usketch-plugin-character:keys`) are carried into the keymap once on a host with a keymap (and then saved by the app's key settings); `saveKeys`, `setKeys`'s `save` option, `captureNextKey` and the `character-keys.ts` helpers are deprecated.
  
  Core: `bindKeymapStorage` keeps rebindings made before it was bound (e.g. ones a plugin carried over) and saves them together with the stored ones. `formatKeyCode` tells left / right modifiers apart (`sides`, default `"Left "` / `"Right "`).

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0

## 0.10.1

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0

## 0.10.0

### Minor Changes

- 4e81c14: The follow camera's height now accounts for jumps and hovers. In the air it holds the take-off height, so an ordinary jump still rises on screen and running off a ledge over a pit doesn't dip the view; a hover or a high multi-jump that climbs more than `cameraHeightMargin` (world units, default = the jump's height) above it drags the camera up, and a fall below it takes the camera down. `0` follows the body exactly; `getCameraHeightMargin` / `setCameraHeightMargin` change it at runtime.

### Patch Changes

- 28a95bf: An airborne character no longer leans with the terrain below it. In the air (jumping, falling, hovering) the body's slope lean fades out over the first `AIR_LEAN_FADE` (8) world units above the ground, so the ground it flies over doesn't tip it. Its shadow still lies along the ground.

## 0.9.0

### Minor Changes

- 9ffa649: Raise the 3D view's camera with the ground. Mode 7's `Camera` gets `height` (world units, default 0; `setHeight`): everything is drawn that much lower, so ground at that height shows where the flat board would. Hold Space / Shift in the 3D view to move the camera up / down (`heightKeys`, `heightSpeed`, rebindable via `setHeightKeys`). In shared, `View3dCamera.heightPx` and the optional `View3dApi.setCameraHeight` carry it; `getRenderedCamera().heightPx`, `projectToGround` / `unprojectFromGround` (now with a `z`) and the elevation mesh honor it. The character's follow camera sets it to the ground under the feet (eased), so walking up a high mountain no longer leaves the view.

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0

## 0.8.0

### Minor Changes

- aabfdc1: キャラの大きさを設定できるようにした。`size` オプション / `setSize` で、画面上いつも同じ大きさ (`scale: "screen"`、既定 36px) か、地面と同じ縮尺 (`scale: "world"`、ズームに合わせて変わり、`minPx` … `maxPx` に収める) を選べる。描く大きさはレンダラーに `size` (画面 px) で渡す。HUD のキャラクターの設定にも「大きさの基準」と「大きさ」を足した。見た目だけで、登れる段差やジャンプの高さは変わらない。

## 0.7.0

### Minor Changes

- 7249582: feat(character): 坂への対応。`motion.maxSlope` より急な坂は登れずずり落ちる（段差は今まで通り `maxStep`）、3D ビューでは地面に沿って傾く（`motion.slopeTilt`）、坂でのジャンプは真上と坂の法線の間に跳ぶ（`jump.slopeRatio`）

## 0.6.1

### Patch Changes

- e92809d: The character spots keep the 3D context down to the renderer's content (`transform-style: preserve-3d`), so under a 3D view (Mode 7) a renderer can stand its sprite up out of the ground (e.g. `rotateX(-pitch)` with the pitch from `view3dService`) instead of having it flattened onto the ground. The flat board looks the same.

## 0.6.0

### Minor Changes

- abc7f44: 3D shapes can now collide with the character. A shape's `x-shape-3d` takes `collision`: `"none"` (default), `"solid"` (a wall) or `"platform"` (a box's top that can be stepped or jumped onto); a stood-up shape blocks along its bottom edge (fixed facing) or at a small disc at its foot (camera facing), a floating one never collides. The shape-3d plugin answers the new shared `solidHeightService` from a grid index of all shapes, and the character combines it with the ground height: walls block (sliding along them), tops are stood on, and moves are checked in short stretches (`sweepToGround`) so a fast move can't skip a thin wall. Collision applies in 2D too unless the new `collisionIn3dOnly` limit is set. Both settings are in the HUD.

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0

## 0.5.1

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0

## 0.5.0

### Minor Changes

- 97ffdde: `setVirtualInput` gains a `jump` button: held, it acts like the jump key (a release while rising cuts the jump short, holding it in a fall hovers, air jumps on each press), so a touch control can jump and hover too. Presses of the virtual jump and drift buttons are latched until the next frame, so a quick tap between frames still jumps (or starts a drift hop). `virtualPresses(prev, next)` is exported for hosts that need the same edges.

## 0.4.0

### Minor Changes

- c14714d: The drift has its own key: the default drift key is now Shift (it was Space, shared with the jump; the jump stays on Space). The HUD "キャラクター" group gains ドリフトのキー / ジャンプのキー (a few keys each, `KEY_CHOICES`) and ドリフトでホップ; `api.getKeys()` returns the bindings. `DriftParams.hop` (default off) makes a drift-key press on the ground hop `hopHeight` (default 10) first, with the drift starting on landing if still held and steering. Since the keys no longer clash, the vehicle scheme now gets air jumps and hover too.
- 41dbc2f: feat(character): ジャンプを追加（`jump` オプション / HUD「ジャンプ（Space）」「ジャンプの高さ」/ `api.jump()`）。足元の高さ `z` を持つ縦方向の物理（重力・小ジャンプ・先行入力・コヨーテ時間）で、ジャンプ中は段差制限を足元から測るので高い崖にも乗れる。`maxStep` を超える落差は重力で落ちる。影を地面に置く `renderShadow` スロットを追加し、Mode 7 では本体が影から浮く。render props に `z` / `altitude` / `airborne` / `verticalSpeed`、awareness に `z` / `airborne` / `vz` を追加
- 77ffc65: Multi-jump and hover. `jump.airJumps` (default 0) gives extra jumps in the air (1 = a double jump), each `airJumpRatio` (default 0.8) × the jump height, reset on landing. `jump.hover` (`true` or a partial `HoverParams`, default off) lets the jump key, held while falling once the air jumps are used up, fire a thrust while a gauge drains (`duration`): `thrust` is a multiple of gravity (default 0 = a glide; above 1 it climbs while the key is held), with the descent capped at `fallSpeed` and the climb at `riseSpeed`; an empty gauge falls normally, and the gauge refills on the ground over `rechargeTime`. The pose and render props gain `hovering` / `hoverGauge` (both broadcast; older clients read as not hovering), and the HUD "キャラクター" group gains 空中ジャンプ回数 / ホバー / ホバー時間(秒) / ホバーの推力(重力比). Both control schemes get them.
- 96f0f66: feat(character): タッチスティックやゲームパッドから操作できる外部入力 API `setVirtualInput({ throttle, steer, drift })` を追加した。`throttle` / `steer` は -1 〜 1 のアナログ値で、押しているキーと足し合わせる（±1 で頭打ち）。部分的なアクセルはその割合の最高速度を目標にし、部分的なハンドルはその割合だけ曲がる。キャラクターを OFF にすると入力は解除される。
  
  - `MoveInput` にアナログの `throttle` / `steer`（任意）を追加し、`stepCharacter` が読むようにした。キー入力だけのときの挙動は変わらない。
  - `getVirtualInput()`、純関数 `combineInput` / `normalizeVirtualInput` / `isVirtualInputActive` / `inputThrottle` / `inputSteer` を公開。

### Patch Changes

- c7e886c: The camera anchor no longer measures the canvas every frame: its size is cached and refreshed on window resize or after 500 ms.

## 0.3.1

### Patch Changes

- 61da0d9: Refine the focus rules for movement keys. A dialog that contains the board no longer blocks driving, and a menubar or listbox now counts as an arrow-key widget instead of taking every key. Focus is read through `composedPath()`, so dialogs inside web components are seen. Composite arrow-key roles (combobox, grid, tablist, radiogroup, toolbar …) are added. Numpad keys that act as arrows are treated as arrows. When focus moves, only the held keys the new target uses are released, so WASD doesn't stutter on a radio and a button pressed with Space while drifting still fires.
- da8a562: Leave movement keys to dialogs, menus and arrow-key widgets. While focus is inside a dialog or menu no bound key is captured, arrow keys are left to a focused slider / radio / tab / option, and moving focus into a text field, dialog or such a widget releases the held keys (so a car no longer keeps driving or steers while you operate a dialog).
- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
  - @edv4h/usketch-shared@4.19.0

## 0.3.0

### Minor Changes

- d099a8d: character: vehicle drift (opt-in `drift` option: hold Space and steer at speed) and the held steering, body slip and drift state on the pose, render props and awareness. `CharacterPose` gains `steering` / `slip` / `drift`, and `parseWireState` now returns the full remote shape (`Omit<RemoteCharacter, "id">`, vehicle fields filled in). mode7: `projectToGround` / `unprojectFromGround` / `tiltOrigin` point math, `transitionCamera` export and `getRenderedCamera()` on the service.
- 8cb3482: map のセルに高さを追加。地形タイプから段（水 0 / 陸 1 / 岩 2 / 山 3 / 雪 4）を自動で決め、Mode 7 では段差を崖として立体表示する。キャラクターは「登れる段差」より高い崖を登れない（降りるのは自由）。高さは共有の `groundHeightService` で公開し、`getMapApi().getHeightAt()` でも取得できる。

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0

## 0.2.3

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0

## 0.2.2

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0

## 0.2.1

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0

## 0.2.0

### Minor Changes

- 64aa091: New plugin: a controllable character. Place it at a chosen screen position, move
  it with customizable keys (WASD by default) in a `directional` or `vehicle`
  scheme, track its heading, and follow it with a camera that keeps the world
  upright (`fixed`) or turns it with the heading (`rotate`, using the Core viewport
  rotation). Other users' characters coexist through awareness. The plugin owns no
  visuals — the look comes from the host's `renderCharacter`.

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0
