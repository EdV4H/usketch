# @edv4h/usketch-session-voting

[`@edv4h/usketch-plugin-session`](../../plugins/usketch-plugin-session) の基盤に乗る
**最初のセッション型「投票」**。サーバー権限モデルなので、**サーバー部＋クライアント部のペア**を
1パッケージにまとめ、サブパス export（`/server` と `/client`）で提供する。

## 特徴

- **重複排除**: userId 単位で1票（`multi` 時はトグル、単一選択の再投票は差し替え）。
- **秘密投票**: 誰が何に入れたかは server-only の `secret` に保持し、`public` には tally しか出さない。
- **ライフサイクル**: host が「締め切る」（集計確定）→「終了」（全員のパネルから削除）。
- **React を server バンドルに持ち込まない**: `/server` は protocol のみに依存、`/client` が UI + React。

## 使い方

```ts
// サーバー（apps/server）
import { votingServerType } from "@edv4h/usketch-session-voting/server";
new SessionManager({ /* deps */, types: [votingServerType] });
```

```ts
// クライアント（web）
import { votingClientType } from "@edv4h/usketch-session-voting/client";
createSessionPlugin({ wsProvider, userId, boardId, types: [votingClientType] });
```

作成 config（`SessionConfig`）:

```ts
{ type: "voting", question: string, options: string[], secret?: boolean, multi?: boolean }
```

## 主な export

| entry | export | 内容 |
|---|---|---|
| `/server` | `votingServerType` | `ServerSessionType`（init/reduce/privateFor/close） |
| `/client` | `votingClientType` | `ClientSessionType`（投票カード＋作成フォームの描画） |
| 両方 | `VotingPublicState` / `VotingConfig` / `VotingPrivateState` | 公開状態・作成 config・自分の投票 |

新しいセッション型（チュートリアル / カードゲーム）は、この構成（`/server` ＋ `/client` のペア）を
まねて 1 パッケージ足すだけで追加できる。
