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
| `wsProvider` | サーバー権限セッションの転送。未指定＝ローカルボードでは no-op |
| `userId` | この端末の userId。WS 接続の識別子と一致させる（host 判定に使用） |
| `boardId` | ボード ID（スコープ / テレメトリ用） |
| `types` | 登録するイベント型（`ClientSessionType[]`）。各々に対応する `ServerSessionType` をサーバーにも登録 |
