---
"@edv4h/usketch-plugin-character": minor
---

feat(character): タッチスティックやゲームパッドから操作できる外部入力 API `setVirtualInput({ throttle, steer, drift })` を追加した。`throttle` / `steer` は -1 〜 1 のアナログ値で、押しているキーと足し合わせる（±1 で頭打ち）。部分的なアクセルはその割合の最高速度を目標にし、部分的なハンドルはその割合だけ曲がる。キャラクターを OFF にすると入力は解除される。

- `MoveInput` にアナログの `throttle` / `steer`（任意）を追加し、`stepCharacter` が読むようにした。キー入力だけのときの挙動は変わらない。
- `getVirtualInput()`、純関数 `combineInput` / `normalizeVirtualInput` / `isVirtualInputActive` / `inputThrottle` / `inputSteer` を公開。
