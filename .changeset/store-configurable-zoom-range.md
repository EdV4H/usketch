---
"@edv4h/usketch-store": minor
---

feat(store): ズーム倍率クランプ [0.1, 10] を `createBoardStore({ zoomRange })` で設定可能に

- `BoardStoreOptions.zoomRange?: { min?: number; max?: number }` を追加。`zoomTo` /
  `fitToBounds` のズーム倍率クランプがこれを参照する。既定は現状どおり
  `{ min: 0.1, max: 10 }` で**後方互換**。
- ホストが ×10 を超えて拡大（または ×0.1 未満に縮小）したい場合にオプトインで可動域を広げられる。
  ```ts
  createBoardStore({ zoomRange: { min: 0.05, max: 40 } });
  ```
- 非正/非有限の境界や `min > max` の破綻指定は無視して既定へフォールバック。
- `setViewportConstraint` は commit をさらに絞ることはできるが、この範囲を超えて広げることはできない
  （クランプが先に効くため）。ホストが可動域を広げる正規手段としてこのオプションを使う。
- `BoardStoreOptions` を index から re-export。
