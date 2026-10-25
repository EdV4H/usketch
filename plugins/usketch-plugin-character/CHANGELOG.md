# @edv4h/usketch-plugin-character

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
