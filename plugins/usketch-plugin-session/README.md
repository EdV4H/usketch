# @edv4h/usketch-plugin-session

Canvas 上で他ユーザーに「イベント」を発生させる**ライブ・インタラクティブ・セッション**の
**フレームワーク**。特定の活動は焼き込まず、投票・チュートリアル・カードゲーム等を**外部の
イベント型**として足せる。最初のイベント型は [`@edv4h/usketch-session-voting`](../../packages/usketch-session-voting)。

**サーバー権限モデル**: Durable Object（`BoardRoom`）がセッションの真実を持ち、公開状態は全員へ、
秘匿状態（誰が何に投票したか / 伏せ札）は本人だけへ配る。だから重複投票・秘密投票・伏せ札が成立する。

## 特徴

- **途中参加**: 接続時にサーバーが現状態を送る（遅参者も即座に参加・操作可能）。
- **途中離脱→再接続**: userId 単位の猶予（DO alarm）で席/状態を保持。同 userId 復帰で自動復元。
- **ホスト移譲**: ホスト離脱＆猶予切れで最古参の接続ユーザーへ移譲。
- **HUD 一本化**: UI は Control HUD パネルに登録（独自ツールバーは作らない）。
- **型を足すだけで拡張**: 新イベント型は `ServerSessionType`（サーバー）＋ `ClientSessionType`
  （クライアント）のペアを1つ作って登録するだけ。

## アーキテクチャ

- **プロトコル**: [`@edv4h/usketch-session-protocol`](../../packages/usketch-session-protocol) の型非依存な封筒
  （`create/join/action/leave/close/end/sync` ↔ `state/private/ended/error`）を
  [`@edv4h/usketch-sync`](../../packages/sync) の `MSG_SESSION` フレームで送受信。
- **サーバー**: `SessionManager`（DO 内）が型レジストリへ委譲。各セッションを `type` で解決し、
  `init/reduce/privateFor/close` を呼ぶ。状態は `ctx.storage` に永続、猶予は DO alarm。
- **クライアント**: 汎用 `session-client` が `SessionView` と自分の private state をローカルミラー、
  接続/再接続時に自動 `sync`。HUD パネルは各 `ClientSessionType` の `renderCard` / `renderCreateForm`
  へ描画委譲。**基盤は voting を知らない**。

## 使い方

```ts
import { createSessionPlugin } from "@edv4h/usketch-plugin-session";
import { votingClientType } from "@edv4h/usketch-session-voting/client";

// クライアント（web）— types に使うイベント型を渡す
createSessionPlugin({
  wsProvider,                 // 未指定（ローカルボード）なら no-op
  userId,                     // WS 接続の識別子と一致させる（host 判定）
  boardId,
  types: [votingClientType],  // 追加のイベント型はここに足す
});
```

```ts
// サーバー（apps/server）— 対応する ServerSessionType を SessionManager に登録
import { votingServerType } from "@edv4h/usketch-session-voting/server";

new SessionManager({ /* deps */, types: [votingServerType] });
```

## 自分のイベント型を作る

`ServerSessionType`（`type` id・`init`・`reduce`・`privateFor`・`close?`）と、
`ClientSessionType`（`type`・`label`・`renderCard`・`renderCreateForm`）のペアを1パッケージにまとめ、
サーバー部を `SessionManager` に、クライアント部を `createSessionPlugin({ types })` に登録する。
サーバー権限モデルなので**ブラウザだけで完結する純クライアント型にはできない**（不正防止のため）。

## オプション（`createSessionPlugin`）

| option | 説明 |
|---|---|
| `wsProvider` | サーバー権限セッションの転送。`client` も無ければ（ローカルボード）no-op |
| `client` | ほかの転送（`createYjsSessionClient` など）。`wsProvider` より優先。ホストが持ち、プラグインは破棄しない |
| `userId` | この端末の userId。WS 接続の識別子と一致させる（host 判定に使用） |
| `boardId` | ボード ID（スコープ / テレメトリ用） |
| `types` | 登録するイベント型（`ClientSessionType[]`）。各々に対応する `ServerSessionType` をサーバーにも登録 |

## サーバーの無いボードで動かす（Yjs の転送）

y-websocket で同期するホストやローカルのボードには `SessionManager` がいない。そこでは
`createYjsSessionClient` を `client` に渡すと、同じセッションの型が全員の端末で動く。

```ts
import { createSessionPlugin, createYjsSessionClient } from "@edv4h/usketch-plugin-session";

const client = createYjsSessionClient({
  doc,                        // 全員が同期している Y.Doc
  userId,
  types: [myServerType],      // サーバー側の半分（init / reduce / privateFor）をここで渡す
  presence: awareness,        // 任意。いない人を connected: false にする（既定は state.user.id で人を見分ける）
});
createSessionPlugin({ client, userId, types: [myClientType] });
```

- セッションは共有ドキュメントの追記型のログ（`usketchSessions` マップ）。各端末が同じログを型の
  `reduce` でたたみ込むので、同時の操作も上書きし合わず、全員が同じ状態になる
- サーバーと同じ決まりにそろえている: 操作すると参加になる、断られた操作は何も変えない、閉じる・終えるは
  主催者だけ、主催者が離れたらいちばん早く入った人が引き継ぐ、最後の人が離れたら終わる
- 主催者を引き継ぐ: `client.claimHost(sessionId)`（`getSessionApi` でも同じ）。主催者がいないあいだだけ通り、
  前の主催者は戻ってきても参加者のまま。サーバーは主催者がつながっているあいだ断り、Yjs の転送は `presence` で
  主催者がいないと分かるときだけ通す（`presence` が無ければ引き継げない）。同時に押したら、ログで後の人が主催者になる
- **権限者がいない**: 正直な端末どうしでは決まりが守られるが、ドキュメントはだれでも読めるので `secret` は
  隠れない。`ServerSessionType.requiresServer(config)` が true の型（秘密の投票など）は作れない

## ホストが自分の UI を描く

HUD を描かないホストは `getSessionApi(app.services)` で一覧・作る・操作するを呼ぶ。`renderCard` /
`renderCreateForm` を省いた型は HUD パネルに出ない。型が状態に合わせて副作用（カメラを動かすなど）を
持つときは `attach(ctx)` を書く（`ctx.client` を自分で購読し、`ctx.store` を触る）。
