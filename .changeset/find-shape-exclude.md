---
"@edv4h/usketch-tool-helpers": minor
---

`findShapeAtPoint` / `trackHover` の `TrackHoverOptions` に `excludeIds` と `filter` を追加（#613）。

- `excludeIds?: ReadonlySet<string> | readonly string[]` — ヒットテストの走査でスキップするシェイプ id。
- `filter?: (shape: ShapeData) => boolean` — `false` を返したシェイプをスキップする述語。

ドラッグ&ドロップで「掴んでいるシェイプの下にあるシェイプへドロップ」する用途で、掴んでいる id（や自分の種別）を除外して「直下の次のシェイプ」を取得できる。既存の精度（precedence）ルールはそのまま。
