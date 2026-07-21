---
"@edv4h/usketch-plugin-timter": minor
---

timer shape の見た目をホスト側でカスタマイズ可能に（issue #754）。

- **`renderShape` render-prop（案A）**: `TimterPluginOptions.renderShape` で timer shape の描画をホスト側から完全に差し替え可能に。プラグインが self-tick / `serverNow` / `actions`（`toggle` / `reset` / `switchType` / `adjust(deltaMs)`）を注入するため、ホストは見た目だけ書けばよい。未指定時は内蔵の `defaultRenderTimerShape`（これも export、ラップして拡張可能）を使用。
- **timer kind 拡張の公開 register API**: `registerTimerKind` / `getTimerKind` / `resolveTimerKind` / `timerTypes` と `TimerKind` 型を公開。`TIMER_KINDS` を registry 化し `TimerType` を任意 kind 許容に緩和したため、ホストが `pomodoro` 等の独自 kind を追加できる（`switch-type` は登録済み全 kind をサイクル）。
- **堅牢性**: 同期された shape が未登録の `timerType`（旧ドキュメント/別クライアントのリモート更新）を持っても、`resolveTimerKind` の inert フォールバックにより render / LOD / Controls rebuild がクラッシュしない。

後方互換: 既存の `{ serverClock, userId }` 呼び出しは無変更で動作。
