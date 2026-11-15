# @edv4h/usketch-plugin-croupier

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
