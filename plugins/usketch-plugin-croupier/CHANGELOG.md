# @edv4h/usketch-plugin-croupier

## 0.1.14

### Patch Changes

- 5dc7d1b: Rotated shapes are now hit, selected, snapped and dropped into where they are drawn. Snapping compares the bounds of each rotated shape's turned outline (moving and target), never snaps a rotation, and skips the resize of a rotated shape. The marquee tests a rotated shape's drawn outline (contain: all corners; intersect: separating-axis). Auto-attach (frames, attachable stickers) and the drop-target highlight treat a rotated container as its turned box, and the highlight is drawn rotated. The frame, counter, timer, board portal, community region, croupier table/seat, voice notes, open slide, community chat and freedraw shapes now hit-test with `withRotation`, and sticky/text start editing on a double-click anywhere on a rotated note. New in `@edv4h/usketch-shared`: `getShapeCorners`, `getShapeWorldAABB`, `rectIntersectsShape`, `shapeBoxContainsPoint`.
- Updated dependencies [5dc7d1b]
- Updated dependencies [8d13a3a]
- Updated dependencies [9aa4ddb]
- Updated dependencies [ba2c89c]
  - @edv4h/usketch-shared@4.31.0
  - @edv4h/usketch-store@3.14.0

## 0.1.13

### Patch Changes

- Updated dependencies [3566290]
  - @edv4h/usketch-shared@4.30.0
  - @edv4h/usketch-store@3.13.2

## 0.1.12

### Patch Changes

- Updated dependencies [66e8499]
  - @edv4h/usketch-shared@4.29.0
  - @edv4h/usketch-store@3.13.1

## 0.1.11

### Patch Changes

- 0c54787: タイマー・投票・Croupier テーブルをアクションで置くときの「画面中央」を shared の `screenCenterWorld` で求めるようにした。ビューが回転しているときも画面の中央に置かれる。
- Updated dependencies [3d0a677]
  - @edv4h/usketch-shared@4.28.0
  - @edv4h/usketch-store@3.13.0

## 0.1.10

### Patch Changes

- Updated dependencies [ee82044]
- Updated dependencies [98df25b]
- Updated dependencies [e2d6d5e]
  - @edv4h/usketch-shared@4.27.0
  - @edv4h/usketch-store@3.12.2

## 0.1.9

### Patch Changes

- Updated dependencies [db5c6f9]
  - @edv4h/usketch-shared@4.26.0
  - @edv4h/usketch-store@3.12.1

## 0.1.8

### Patch Changes

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
  - @edv4h/usketch-store@3.12.0

## 0.1.7

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-store@3.11.6

## 0.1.6

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0
  - @edv4h/usketch-store@3.11.5

## 0.1.5

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0
  - @edv4h/usketch-store@3.11.4

## 0.1.4

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-store@3.11.3

## 0.1.3

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-store@3.11.2

## 0.1.2

### Patch Changes

- f4fd42c: The table housekeeping that runs on every shapes change (each frame of any drag) now walks the board once instead of six times, so dragging on a board with game tables is cheaper. No behaviour change.

## 0.1.1

### Patch Changes

- d43705f: A table that is playing or finished but has no game (for example, a running table brought back by undoing its deletion) now goes back to the lobby instead of staying stuck.

## 0.1.0

### Minor Changes

- a8f4b3a: 新規プラグイン。croupier（`@edv4h/croupier-core`）のゲームをボード上で遊べるようにする。テーブルシェイプがゲームとエンジンの snapshot を持ち、参加者ごとに座席シェイプを置く。ルールはホストアプリが渡すゲーム定義（Values Card など）に任せ、通常のシェイプ同期だけで動く（ゲームサーバー不要）。手番制のゲームだけに対応する（全員が同時に動くゲームは書き込みがぶつかるため非対応）。不在のプレイヤーの手番はホストのクライアントがゲームの bot で進め、ホストが抜けたら次の参加者に移る。

### Patch Changes

- Updated dependencies [ca67108]
  - @edv4h/usketch-store@3.11.1
