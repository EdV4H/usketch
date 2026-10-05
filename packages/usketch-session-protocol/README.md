# @edv4h/usketch-session-protocol

[`@edv4h/usketch-plugin-session`](../../plugins/usketch-plugin-session) の**ライブ・セッション**の
client↔server 共通**ワイヤ契約（型のみ・ランタイム無し）**。`apps/server`（権威 `SessionManager`）と
クライアントのフレームワークの両方が import する。

## 特徴

- **型非依存の封筒**: `SessionType = string`。`public` / private `data` / `action` / create `config`
  （`type` 判別子を除く）はすべて `unknown`。各セッション型が自分の payload を所有・検証するので、
  新しい型を足しても本契約は変えなくてよい。
- **サーバー権限**: サーバーが状態・ルール（重複排除・host 限定操作・ターン順）・秘匿状態を持ち、
  公開ビューだけ全員へ、private は本人の socket だけへ配る。

## 主な export

| export | 種類 | 内容 |
|---|---|---|
| `SessionView<TPublic>` | interface | クライアントから見た公開セッション（id / type / hostUserId / participants / public） |
| `Participant` | interface | userId・role・接続状態 |
| `SessionConfig` | interface | 作成 payload（`type` 判別子＋型固有フィールド） |
| `ClientToServer` | union | `create` / `join` / `action` / `leave` / `close` / `end` / `sync` |
| `ServerToClient` | union | `state` / `private` / `ended` / `error` |
| `ServerSessionType` | interface | サーバー側のセッション型契約（`init` / `reduce` / `privateFor` / `close?` ＋ 自己記述する `type` id） |

## 転送

[`@edv4h/usketch-sync`](../../packages/sync) の **`MSG_SESSION`** フレーム（`WsProviderHandle.sendSession` /
`onSession`）で双方向にやり取りする。`broadcast` の盲目リレーとは別で、サーバーが**処理**するチャネル。

```ts
import type { ClientToServer, ServerToClient, ServerSessionType } from "@edv4h/usketch-session-protocol";
```

実装例は [`@edv4h/usketch-session-voting`](../usketch-session-voting)（最初のセッション型）を参照。
