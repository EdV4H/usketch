---
"@edv4h/usketch-plugin-free-position": minor
"@edv4h/usketch-shape-utils": minor
"@edv4h/usketch-plugin-keyboard-shortcuts": minor
---

指定位置から「最も近い被らない位置」を求める機能を追加（#581）。

- `@edv4h/usketch-shape-utils`: 純関数 `findFreePosition`（`ring` / `push` の2戦略）と `overlapsAny` を追加。
- `@edv4h/usketch-plugin-free-position`（新規）: `free-position:find` イベントで問い合わせ可能。
  ボード上の shape を**回転考慮 AABB**で避けた最近傍の空き位置を返す。
- `@edv4h/usketch-plugin-keyboard-shortcuts`: paste/duplicate が `free-position:find` を使い、
  複数 shape を相対配置を保ったままグループ単位で被らない位置へ自動配置（free-position 未登録時は
  従来の +20 オフセットにフォールバック）。
