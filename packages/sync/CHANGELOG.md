# @edv4h/usketch-sync

## 1.2.0

### Minor Changes

- 6a1e9b9: ライブ・セッション基盤（サーバー権限）Phase 1: プロトコル＋サーバー＋クライアント channel

  Canvas 上で他ユーザーに「イベント」を発生させる共有インタラクティブ・セッション（投票/チュートリアル/カードゲーム）の土台。Durable Object をセッションの権威にし、公開状態は全員へ、秘匿状態（誰が何に投票したか等）は本人のみへ配る。途中参加は接続時の state 再送、途中離脱→復帰は userId 単位の猶予（DO alarm）＋再接続で担保、ホスト離脱はホスト移譲。
  - 新パッケージ `@edv4h/usketch-session-protocol`: client↔server 共通の型（メッセージ union・voting の公開/秘匿/config 型）。
  - `@edv4h/usketch-sync`: `MSG_SESSION` フレームと `WsProviderHandle.sendSession`/`onSession` を追加（server が処理する双方向チャネル。broadcast の盲目リレーとは別）。
  - サーバー(apps/server): `SessionManager`（作成/参加/アクション/離脱/締め・presence・猶予/再接続・ホスト移譲・DO alarm・DO storage 永続、純粋クラスで単体テスト可）＋ voting 型（重複回避・secret ballot・再投票差し替え・multi）。board-room に配線。単体テスト12件。

  Phase 2 でクライアントプラグイン（HUD 投票UI）と旧 voting 廃止を行う。

## 1.1.0

### Minor Changes

- 4148a9c: 共有タイマープラグイン `usketch-plugin-timter` を追加（issue #737）。**複数タイマー**を同時に持て、**タイプ**（countdown / stopwatch）を最初から扱える拡張可能設計（`TIMER_KINDS` に足せば新タイプ追加）。タイマーは**単一の実体＝`timer` シェイプ**（配置・移動・リサイズ・選択・undo 可能）で、通常のシェイプ同期に乗って全ユーザーへ同期＋永続化（サーバの同期処理は改修不要、遅参加/リロードでも即再現）。Debug HUD の Controls（group "Timter"）から追加・一覧・各操作（開始/一時停止/リセット/削除）・全削除ができ、キャンバスのツールで置いたタイマーも Controls に出る（同一リストを共有）。

  時刻同期のため `@edv4h/usketch-sync` に `createServerClock`（Cristian's algorithm でサーバ時計オフセットを推定、最小 RTT サンプル採用）を追加。タイマーは終了/開始時刻を**サーバ時計基準**で保存するため、端末の時計ずれに影響されず全員の表示が一致する。solo/オフラインは offset=0 のローカル時計に自動フォールバック。固有 UI は持たず、全操作を `ctx.actions.register` で公開して Debug HUD の Controls（group "Timter"）に統合（追加/全削除＋各タイマーの開始・一時停止/リセット/削除、実行中は1秒ごとにラベル更新）。

## 1.0.0

### Major Changes

- 🎉 Initial stable release — v1.0.0

  uSketch v2 の最初の安定版リリース。MVP 完了基準をすべて満たした状態で公開する。

  ## Highlights
  - **Realtime collaboration** — Cloudflare Durable Objects + Yjs + WebSocket awareness
  - **Offline-first** — y-indexeddb によるローカル永続化、再接続時の自動同期
  - **Pluggable architecture** — 60+ の plugin（shape / tool / sync / AI / presence / export 等）
  - **Presentation mode** — Frame ベースのスライド、edit/present の 2 モード
  - **Export** — PNG / SVG / JSON（Satori + Canvas）
  - **Link sharing & access control** — 公開/限定公開 + role 管理（owner/editor/viewer）
  - **AI-native** — Copilot（ghost shape 提案）/ Chat / Voice / Image 認識

  詳細なリリースノートはルートの `CHANGELOG.md` を参照。
