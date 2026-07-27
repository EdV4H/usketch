---
"@edv4h/usketch-plugin-timter": minor
---

`createTimterPlugin` にサイズと duration 下限のオプションを追加（#784 / #781）。

- **`minSize` / `defaultSize`（#784）**: timer shape の最小サイズ（既定 120×90）と新規作成サイズ（既定 160×120）をホストから指定可能に。`renderShape` でカスタム UI を置く際、コントロールが折り返さない最小幅を確保できる。ハードコードだった `minSize`・resize クランプ・`createDefault`・draw ツールの既定サイズ/オフセットが全てオプション連動に。
- **`minDurationMs`（#781）**: countdown の duration 下限（既定 60_000ms）。`1_000` 等にすると 1 分未満（0:30 など秒単位）を許可。`adjust` のクランプが `Math.max(60_000, …)` からこの値基準に変更。
- **`set-duration` アクション追加（#781）**: `TimerShapeActions.setDuration(ms)` で絶対値の duration を設定可能（`minDurationMs` にクランプ）。ホストの「分:秒」入力から 0:01〜 を直接設定できる。
- `makeTimerShape` に `size` 引数を追加。
