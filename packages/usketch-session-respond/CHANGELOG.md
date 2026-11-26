# @edv4h/usketch-session-respond

## 0.2.7

### Patch Changes

- Updated dependencies [546c8b8]
  - @edv4h/usketch-shared@4.34.0
  - @edv4h/usketch-plugin-session@0.4.7

## 0.2.6

### Patch Changes

- Updated dependencies [1b665c3]
  - @edv4h/usketch-shared@4.33.0
  - @edv4h/usketch-plugin-session@0.4.6

## 0.2.5

### Patch Changes

- Updated dependencies [61ee9e6]
- Updated dependencies [56a137e]
  - @edv4h/usketch-shared@4.32.0
  - @edv4h/usketch-plugin-session@0.4.5

## 0.2.4

### Patch Changes

- Updated dependencies [5dc7d1b]
- Updated dependencies [8d13a3a]
- Updated dependencies [9aa4ddb]
- Updated dependencies [ba2c89c]
  - @edv4h/usketch-shared@4.31.0
  - @edv4h/usketch-plugin-session@0.4.4

## 0.2.3

### Patch Changes

- Updated dependencies [3566290]
  - @edv4h/usketch-shared@4.30.0
  - @edv4h/usketch-plugin-session@0.4.3

## 0.2.2

### Patch Changes

- Updated dependencies [66e8499]
  - @edv4h/usketch-shared@4.29.0
  - @edv4h/usketch-plugin-session@0.4.2

## 0.2.1

### Patch Changes

- Updated dependencies [3d0a677]
  - @edv4h/usketch-shared@4.28.0
  - @edv4h/usketch-plugin-session@0.4.1

## 0.2.0

### Minor Changes

- 356879b: 答えにかけら (`parts`) を付けられるようにした。始めるときの `maxParts` (0〜50、既定 0) で許し、`submit(text, tag?, parts?)` で出す。`flattenResponseParts` でかけら 1 つずつの答えに開いて並べられる。答えの長さの上限も `maxText` (1〜2,000、既定 280) で決められる。いまの使い方は何も変わらない。

### Patch Changes

- Updated dependencies [b01b7f0]
  - @edv4h/usketch-session-protocol@0.4.0
  - @edv4h/usketch-plugin-session@0.4.0

## 0.1.0

### Minor Changes

- fa6d984: 新しいセッション型「答える」(`respond`) を足した。主催者がお題を出し、みんなが答え (と任意のタグ) を出す。答えは主催者がまとめるまで本人にしか見えず、まとめると全員の答えが公開される。答えを枠の中に並べる位置の計算 (`arrangeResponses`) も持つ。
