# @edv4h/usketch-session-respond

[`@edv4h/usketch-plugin-session`](../../plugins/usketch-plugin-session) の上に乗るセッション型
**「答える」(`respond`)**。主催者がお題を出し、みんなが自分の答えを出す。答えは主催者が
「まとめる」(reveal) まで、本人にしか見えない。

## 振る舞い

- **お題** (`prompt`): 空でない文字列 (280 字まで)
- **答える** (`submit(text, tag?)`): だれでも出せる。出し直すと差し替わる (並びの順番は最初に出したときのまま)。`retract()` で取り下げる
  - `tag` は省ける短い文字列 (64 字まで)。意味はホストが決める (気持ち・分類など)。並べるときのグループ分けに使える
- **見えるもの**: 公開状態には「答えた人」(`answeredUserIds`、最初に答えた順) だけが出る。答えの中身は session の `secret` に置き、`privateFor` で本人の答えだけを返す
  - サーバーの転送なら本当に隠れる。Yjs の共有ドキュメントの転送では doc にはすべて入るが、この API からは見せない
- **まとめる** (`reveal()`、主催者だけ): session の `close`。全員の答えが公開状態 (`answers`) に移り、それ以降は答えを受け付けない
- **終わり**: 主催者が `end()` する、または 3 時間の安全弁 (主催者の端末が消す)

## 使い方

```ts
// サーバー (apps/server)
import { respondServerType } from "@edv4h/usketch-session-respond/server";
new SessionManager({ /* deps */, types: [respondServerType] });
```

```ts
// クライアント
import { createRespondClientType, getRespondApi, arrangeResponses } from "@edv4h/usketch-session-respond/client";

createSessionPlugin({ client, userId, types: [createRespondClientType()] });

const respond = getRespondApi(app.services);
respond?.start({ prompt: "いまの気持ちは？", hostName: me.name });
respond?.submit("たのしい", "joy");
respond?.reveal();
const { respond: r } = respond?.getState() ?? {};
const placed = arrangeResponses(r?.answers ?? [], {
	area: frameRect,
	itemWidth: 200,
	itemHeight: 200,
	groupOf: (a) => a.tag,
});
```

## 主な export

| entry | export | 内容 |
|---|---|---|
| `/server` | `respondServerType` | `ServerSessionType`。操作は `submit` / `retract`、`close` でまとめる |
| `/client` | `createRespondClientType(options)` | `ClientSessionType`。HUD のカードは持たない |
| `/client` | `getRespondApi(services)` / `RespondApi` | ホストが UI を描く口 (`getState` / `subscribe` / `start` / `submit` / `retract` / `reveal` / `end`) |
| `/client` | `arrangeResponses` | 答えを枠の中に格子で並べる位置 (グループごとに行を分けられる、純関数) |
| `/client` | `parseRespond` / `createRespondConfig` / `parseRespondAction` | 状態の読み書き (純関数) |
| 両方 | `RespondPublic` / `RespondAnswer` / `RespondConfig` / `RespondAction` | 公開状態・答え・作成 config・操作 |
