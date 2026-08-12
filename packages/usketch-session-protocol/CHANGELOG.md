# @edv4h/usketch-session-protocol

## 0.2.0

### Minor Changes

- 6a1e9b9: ライブ・セッション基盤（サーバー権限）Phase 1: プロトコル＋サーバー＋クライアント channel

  Canvas 上で他ユーザーに「イベント」を発生させる共有インタラクティブ・セッション（投票/チュートリアル/カードゲーム）の土台。Durable Object をセッションの権威にし、公開状態は全員へ、秘匿状態（誰が何に投票したか等）は本人のみへ配る。途中参加は接続時の state 再送、途中離脱→復帰は userId 単位の猶予（DO alarm）＋再接続で担保、ホスト離脱はホスト移譲。
  - 新パッケージ `@edv4h/usketch-session-protocol`: client↔server 共通の型（メッセージ union・voting の公開/秘匿/config 型）。
  - `@edv4h/usketch-sync`: `MSG_SESSION` フレームと `WsProviderHandle.sendSession`/`onSession` を追加（server が処理する双方向チャネル。broadcast の盲目リレーとは別）。
  - サーバー(apps/server): `SessionManager`（作成/参加/アクション/離脱/締め・presence・猶予/再接続・ホスト移譲・DO alarm・DO storage 永続、純粋クラスで単体テスト可）＋ voting 型（重複回避・secret ballot・再投票差し替え・multi）。board-room に配線。単体テスト12件。

  Phase 2 でクライアントプラグイン（HUD 投票UI）と旧 voting 廃止を行う。

- 03a3345: ライブ・セッション基盤を「**汎用フレームワーク ＋ 外部イベント型**」構成に

  Canvas 上で他ユーザーに「イベント」を発生させる共有インタラクティブ・セッションを、
  特定の活動（投票）を焼き込まず、**基盤に各自がイベント型を足せる**設計にした。サーバー
  権限モデルなので、イベント型は **サーバー部（`ServerSessionType`）＋ クライアント部（UI
  登録）のペア**として1パッケージにまとめる（tldraw の ShapeUtil 登録を両層でやる形）。
  - `@edv4h/usketch-session-protocol`: 封筒を**型非依存**に汎用化（`SessionType = string`、
    `public`/private `data`/`action`/`config` は `unknown`）。サーバー拡張契約
    `ServerSessionType`（init/reduce/privateFor/close ＋ 自己記述する `type` id）をここへ移設。
  - `@edv4h/usketch-plugin-session`: **フレームワーク化**。汎用 `session-client`（`act` 中心・
    投票非依存）＋ HUD パネルの外枠＋クライアント型レジストリ。`createSessionPlugin({ types })`
    に登録された各 `ClientSessionType`（`renderCard`/`renderCreateForm`）へ描画を委譲。基盤は
    もう voting を知らない。`SessionManager` は型レジストリを注入で受け取る。
  - 新パッケージ `@edv4h/usketch-session-voting`: 投票を**最初の外部イベント型**として実装。
    `./server`（`votingServerType`）と `./client`（`votingClientType`）の2エントリで、
    `apps/server` と `apps/web` がそれぞれ import。サーバーバンドルに React は入らない。
  - `@edv4h/usketch-plugin-voting`: 旧 blind-relay 実装は引き続き `@deprecated`。

  新しいイベント型（チュートリアル/カードゲーム）は、この基盤に `ServerSessionType` ＋
  `ClientSessionType` のペアを1パッケージ足すだけで追加できる。既存の投票の挙動・単体テスト
  （サーバー13・クライアント10）は不変。

### Patch Changes

- 0b30d54: ライブ・セッション基盤 Phase 2: クライアント投票プラグイン（HUD UI）＋旧 voting 廃止

  Phase 1 のサーバー権限セッション基盤を、実際にブラウザで使えるクライアントプラグインとして公開。UUI は方針どおり Control HUD に登録（独自ツールバー/パネルは作らない）。
  - 新パッケージ `@edv4h/usketch-plugin-session`: `createSessionPlugin({ wsProvider, userId, boardId })`。
    - `session-client`: `MSG_SESSION` チャネル（`sendSession`/`onSession`）をラップし、公開 `SessionView` と自分の private state をローカルミラー。接続/再接続時に自動 `sync`（途中参加・再接続で現状態へ追従）。サーバーが権威なので UI は intent 送信＋再描画のみ。
    - HUD パネル「セッション」: 投票作成フォーム（質問・最大4選択肢・秘密投票・複数選択、各項目にラベル/placeholder）、進行中投票のライブ tally バー、自分の投票ハイライト。
    - host の投票ライフサイクル: 「締める」= 集計を締切（結果は締切表示で残す）、締切後に「終了」= 全員のパネルから削除。`session-protocol` に host 専用 `end` メッセージを追加（サーバーが `ended` を配信してセッションを除去）。
    - UI は HUD パネルに一本化。汎用アクション（`ctx.actions`）はラベル無しの入力列になり多項目フォームには不向きなため、create アクションは登録しない。
    - スタイルはアプリのデザイントークン（`--bg-*`/`--fg-*`/`--border-*`/`--u-1` 等の CSS 変数）で構成し、Control HUD にライト/ダーク両対応で馴染む。host でないカードには「主催: … ／ あなた: …」を表示して権限の所在を明示（anonymous 接続などの取り違えを可視化）。
    - `wsProvider` 無し（ローカルボード）ではサーバー権限が前提のため no-op。
  - web(apps/web): cloud board で `createSessionPlugin` を登録。
  - `@edv4h/usketch-plugin-voting`: `createVotingPlugin` を `@deprecated` 化（blind-relay で永続状態を持たず重複回避・遅参不可のため）。web からは未登録。

  クライアントミラーの単体テスト10件（state/private/ended/error 適用・sync-on-connect・送信フレーム）。
