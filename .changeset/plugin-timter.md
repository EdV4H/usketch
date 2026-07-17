---
"@edv4h/usketch-plugin-timter": minor
"@edv4h/usketch-sync": minor
---

共有タイマープラグイン `usketch-plugin-timter` を追加（issue #737）。**複数タイマー**を同時に持て、**タイプ**（countdown / stopwatch）を最初から扱える拡張可能設計（`TIMER_KINDS` に足せば新タイプ追加）。状態は共有 `Y.Doc` の `timters` マップに保持し、既存の Durable Object リレーで全ユーザーへ同期＋永続化（サーバの同期処理は改修不要、遅参加/リロードでも即再現）。

時刻同期のため `@edv4h/usketch-sync` に `createServerClock`（Cristian's algorithm でサーバ時計オフセットを推定、最小 RTT サンプル採用）を追加。タイマーは終了/開始時刻を**サーバ時計基準**で保存するため、端末の時計ずれに影響されず全員の表示が一致する。solo/オフラインは offset=0 のローカル時計に自動フォールバック。UI は画面隅の固定 HUD（一覧＋各タイマーの開始/一時停止/リセット/削除）と Control HUD アクション（追加/全削除）。
