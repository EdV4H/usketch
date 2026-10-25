# @edv4h/usketch-plugin-character

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
