# @edv4h/usketch-session-voting

## 0.2.4

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.4

## 0.2.3

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.3

## 0.2.2

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.2

## 0.2.1

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.1

## 0.2.0

### Minor Changes

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

- Updated dependencies [6a1e9b9]
- Updated dependencies [0b30d54]
- Updated dependencies [03a3345]
  - @edv4h/usketch-session-protocol@0.2.0
  - @edv4h/usketch-plugin-session@0.2.0
