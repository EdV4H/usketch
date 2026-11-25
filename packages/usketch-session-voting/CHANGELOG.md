# @edv4h/usketch-session-voting

## 0.2.26

### Patch Changes

- @edv4h/usketch-plugin-session@0.4.6

## 0.2.25

### Patch Changes

- @edv4h/usketch-plugin-session@0.4.5

## 0.2.24

### Patch Changes

- @edv4h/usketch-plugin-session@0.4.4

## 0.2.23

### Patch Changes

- @edv4h/usketch-plugin-session@0.4.3

## 0.2.22

### Patch Changes

- @edv4h/usketch-plugin-session@0.4.2

## 0.2.21

### Patch Changes

- @edv4h/usketch-plugin-session@0.4.1

## 0.2.20

### Patch Changes

- Updated dependencies [b01b7f0]
  - @edv4h/usketch-session-protocol@0.4.0
  - @edv4h/usketch-plugin-session@0.4.0

## 0.2.19

### Patch Changes

- 3bcacb7: セッションを、セッションサーバーの無いボードでも動かせるようにしました。Yjs で同期するボード (y-websocket のホスト・ローカルのボード) でも、同じセッションの型が全員の端末で動きます。
  
  - plugin-session: `createYjsSessionClient({ doc, userId, types, presence? })`。セッションを共有ドキュメントに追記型のログとして置き、各端末が型の `reduce` でたたみ込むので、同時の操作も上書きし合いません。サーバーが無いので `secret` は隠せません
  - plugin-session: `createSessionPlugin({ client })` で任意の転送を渡せます (ホストが持ち、プラグインは破棄しない)
  - plugin-session: `getSessionApi(services)`。HUD を描かないホストが自分の UI からセッションを作る・操作する口
  - plugin-session: `ClientSessionType.attach(ctx)`。型が状態に合わせて副作用 (カメラを動かすなど) を持てます。`renderCard` / `renderCreateForm` は省けるようになり、省いた型は HUD パネルに出ません。どの型も描かないときはパネル自体を出しません
  - session-protocol: `ServerSessionType.requiresServer(config)`。サーバーでしか動かせない型 (秘密の投票など) を示し、Yjs の転送では作れません
  - session-voting: 秘密の投票は `requiresServer` で Yjs の転送では作れないようにしました
- Updated dependencies [3bcacb7]
  - @edv4h/usketch-plugin-session@0.3.0
  - @edv4h/usketch-session-protocol@0.3.0

## 0.2.18

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.18

## 0.2.17

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.17

## 0.2.16

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.16

## 0.2.15

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.15

## 0.2.14

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.14

## 0.2.13

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.13

## 0.2.12

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.12

## 0.2.11

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.11

## 0.2.10

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.10

## 0.2.9

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.9

## 0.2.8

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.8

## 0.2.7

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.7

## 0.2.6

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.6

## 0.2.5

### Patch Changes

- @edv4h/usketch-plugin-session@0.2.5

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
