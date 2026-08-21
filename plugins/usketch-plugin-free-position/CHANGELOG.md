# @edv4h/usketch-plugin-free-position

## 0.1.11

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-shape-utils@2.2.8

## 0.1.10

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-shape-utils@2.2.7

## 0.1.9

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-shape-utils@2.2.6

## 0.1.8

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-shape-utils@2.2.5

## 0.1.7

### Patch Changes

- Updated dependencies [15f1fe7]
  - @edv4h/usketch-shape-utils@2.2.4

## 0.1.6

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-shape-utils@2.2.3

## 0.1.5

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-shape-utils@2.2.2

## 0.1.4

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-shape-utils@2.2.1

## 0.1.3

### Patch Changes

- Updated dependencies [23fcc87]
- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shape-utils@2.2.0
  - @edv4h/usketch-shared@4.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-shape-utils@2.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-shape-utils@2.1.1

## 0.1.0

### Minor Changes

- a0c2cf9: 指定位置から「最も近い被らない位置」を求める機能を追加（#581）。
  - `@edv4h/usketch-shape-utils`: 純関数 `findFreePosition`（`ring` / `push` の2戦略）と `overlapsAny` を追加。
  - `@edv4h/usketch-plugin-free-position`（新規）: `free-position:find` イベントで問い合わせ可能。
    ボード上の shape を**回転考慮 AABB**で避けた最近傍の空き位置を返す。
  - `@edv4h/usketch-plugin-keyboard-shortcuts`: paste/duplicate が `free-position:find` を使い、
    複数 shape を相対配置を保ったままグループ単位で被らない位置へ自動配置（free-position 未登録時は
    従来の +20 オフセットにフォールバック）。desired bounds は `ShapeDefinition.getBounds` +
    回転考慮で算出し、平行移動は `ShapeDefinition.move` 経由で行う。
  - `@edv4h/usketch-connector-anchor`: `moveConnector`（`ShapeDefinition.move` 実装）を追加。
    コネクタの `sourcePoint` / `targetPoint` / `controlPoint`（絶対座標）を x/y と同じオフセットで
    平行移動する。
  - `@edv4h/usketch-plugin-shape-connector` / `@edv4h/usketch-plugin-domain-design`: コネクタ shape に
    `move: moveConnector` を登録。paste/duplicate/移動で endpoints が取り残されて形状が崩れるのを防ぐ。

### Patch Changes

- Updated dependencies [8d341b3]
- Updated dependencies [a0c2cf9]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-shape-utils@2.1.0
