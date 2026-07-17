# @edv4h/usketch-plugin-timter

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
