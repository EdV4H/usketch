# @edv4h/usketch-plugin-character

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
