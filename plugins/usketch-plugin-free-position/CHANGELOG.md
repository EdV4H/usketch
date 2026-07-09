# @edv4h/usketch-plugin-free-position

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
