# @edv4h/usketch-plugin-timter

## 0.3.9

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0

## 0.3.8

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-store@3.5.4

## 0.3.7

### Patch Changes

- Updated dependencies [06f3ef8]
  - @edv4h/usketch-sync@1.3.0

## 0.3.6

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-store@3.5.3

## 0.3.5

### Patch Changes

- Updated dependencies [6a1e9b9]
  - @edv4h/usketch-sync@1.2.0

## 0.3.4

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-store@3.5.2

## 0.3.3

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 0.3.2

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 0.3.1

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 0.3.0

### Minor Changes

- 68b8c53: `createTimterPlugin` にサイズと duration 下限のオプションを追加（#784 / #781）。
  - **`minSize` / `defaultSize`（#784）**: timer shape の最小サイズ（既定 120×90）と新規作成サイズ（既定 160×120）をホストから指定可能に。`renderShape` でカスタム UI を置く際、コントロールが折り返さない最小幅を確保できる。ハードコードだった `minSize`・resize クランプ・`createDefault`・draw ツールの既定サイズ/オフセットが全てオプション連動に。
  - **`minDurationMs`（#781）**: countdown の duration 下限（既定 60_000ms）。`1_000` 等にすると 1 分未満（0:30 など秒単位）を許可。`adjust` のクランプが `Math.max(60_000, …)` からこの値基準に変更。
  - **`set-duration` アクション追加（#781）**: `TimerShapeActions.setDuration(ms)` で絶対値の duration を設定可能（`minDurationMs` にクランプ）。ホストの「分:秒」入力から 0:01〜 を直接設定できる。
  - `makeTimerShape` に `size` 引数を追加。

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

## 0.2.0

### Minor Changes

- 61d775c: timer shape の見た目をホスト側でカスタマイズ可能に（issue #754）。
  - **`renderShape` render-prop（案A）**: `TimterPluginOptions.renderShape` で timer shape の描画をホスト側から完全に差し替え可能に。プラグインが self-tick / `serverNow` / `actions`（`toggle` / `reset` / `switchType` / `adjust(deltaMs)`）を注入するため、ホストは見た目だけ書けばよい。未指定時は内蔵の `defaultRenderTimerShape`（これも export、ラップして拡張可能）を使用。
  - **timer kind 拡張の公開 register API**: `registerTimerKind` / `getTimerKind` / `resolveTimerKind` / `timerTypes` と `TimerKind` 型を公開。`TIMER_KINDS` を registry 化し `TimerType` を任意 kind 許容に緩和したため、ホストが `pomodoro` 等の独自 kind を追加できる（`switch-type` は登録済み全 kind をサイクル）。
  - **堅牢性**: 同期された shape が未登録の `timerType`（旧ドキュメント/別クライアントのリモート更新）を持っても、`resolveTimerKind` の inert フォールバックにより render / LOD / Controls rebuild がクラッシュしない。

  後方互換: 既存の `{ serverClock, userId }` 呼び出しは無変更で動作。

## 0.1.0

### Minor Changes

- 4148a9c: 共有タイマープラグイン `usketch-plugin-timter` を追加（issue #737）。**複数タイマー**を同時に持て、**タイプ**（countdown / stopwatch）を最初から扱える拡張可能設計（`TIMER_KINDS` に足せば新タイプ追加）。タイマーは**単一の実体＝`timer` シェイプ**（配置・移動・リサイズ・選択・undo 可能）で、通常のシェイプ同期に乗って全ユーザーへ同期＋永続化（サーバの同期処理は改修不要、遅参加/リロードでも即再現）。Debug HUD の Controls（group "Timter"）から追加・一覧・各操作（開始/一時停止/リセット/削除）・全削除ができ、キャンバスのツールで置いたタイマーも Controls に出る（同一リストを共有）。

  時刻同期のため `@edv4h/usketch-sync` に `createServerClock`（Cristian's algorithm でサーバ時計オフセットを推定、最小 RTT サンプル採用）を追加。タイマーは終了/開始時刻を**サーバ時計基準**で保存するため、端末の時計ずれに影響されず全員の表示が一致する。solo/オフラインは offset=0 のローカル時計に自動フォールバック。固有 UI は持たず、全操作を `ctx.actions.register` で公開して Debug HUD の Controls（group "Timter"）に統合（追加/全削除＋各タイマーの開始・一時停止/リセット/削除、実行中は1秒ごとにラベル更新）。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
- Updated dependencies [4148a9c]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-sync@1.1.0
  - @edv4h/usketch-store@3.3.1
