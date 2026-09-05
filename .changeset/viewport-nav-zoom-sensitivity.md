---
"@edv4h/usketch-plugin-viewport-nav": minor
---

feat(viewport-nav): ホイール/トラックパッドのズーム感度を設定可能に（deltaY 比例 + zoomSensitivity）

- `createViewportNavPlugin(options?)` に `ViewportNavOptions.zoomSensitivity` を追加。
- ズーム係数を `deltaY` の**符号だけ**の固定 `0.9/1.1` から、**大きさに比例**する
  `exp(-deltaY * 0.001 * zoomSensitivity)` に変更。小さい `deltaY` を連発する
  トラックパッドのピンチと `deltaY≈±100` のマウスホイールとの体感差が縮む。
- `zoomSensitivity` 省略時（=1）は従来の 0.9/1.1 とほぼ同じ挙動＝**後方互換**。
  範囲は 0.25〜3 にクランプ。
- `zoomSensitivity` は `number` に加えて **`() => number`（getter）** も受け付ける。
  wheel イベントごとに評価するため、設定 UI からの感度変更をライブ反映できる。
- `ViewportNavOptions` を re-export。README を追加。
