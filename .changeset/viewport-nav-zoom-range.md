---
"@edv4h/usketch-plugin-viewport-nav": minor
---

feat(viewport-nav): zoomSensitivity のクランプ上限を 6 に引き上げ＋可動域を上書き可能に

- `zoomSensitivity` のクランプ既定上限を `3` → `6` に引き上げ（トラックパッドでの最速要望に対応）。
  既定 `zoomSensitivity=1` は不変で**後方互換**。
- `ViewportNavOptions.zoomSensitivityRange?: { min?; max? }` を追加。ホストがクランプ可動域
  （既定 `{ min: 0.25, max: 6 }`）を上書きできる。`min > max` などの破綻指定は無視して既定へフォールバック。
  範囲は setup 時に一度だけ解決（`zoomSensitivity` の getter は wheel ごとに評価）。
- README を更新。
