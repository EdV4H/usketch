# @edv4h/usketch-session-gather

[`@edv4h/usketch-plugin-session`](../../plugins/usketch-plugin-session) の上に乗るセッション型
**「集合」(`gather`)**。誰かが始めると、ボードにいる全員がその場所に集まる。始まったあとに
ボードを開いた人も同じ場所に入る。

秘密の状態も操作も無いので、セッションサーバーの転送でも、Yjs の共有ドキュメントの転送
(`createYjsSessionClient`) でも同じように動く。

## 振る舞い

- **場所**: 選んだ図形の範囲 (1 つだけ選んだときはその図形を追う。フレームを動かすと場所も動く)、
  または主催者がいま見ている範囲。複数ページのボードではページも覚える
- **集め方** (`hold`)
  - `gather`: 一度連れて行くだけ。あとは自由に動ける
  - `stay`: 離れるまで場所の中にとどめる (ズームアウトと場所の外へのパンを止める。回転したカメラには触らない)
- **見出しとお題**: `title` (見出し) と `prompt` (みんなへの問いかけ) は、どちらも省ける文字列。ホストの UI が表示に使う
- **背景** (`backdrop`): 演出やイベント中の画面の後ろに出すもの。`color` (16 進の色) と `imageUrl` (http(s) の画像 URL) のどちらも省ける。それ以外の値は落とす。どう描くかはホストが決める
- **だれがいつ動くか**
  - 主催者: 動かさない (`start(..., { stayPut: true })` で今の画面のまま始められる)。とどめもしない
  - 始まったときボードを開いていた人: 3 秒のカウントダウンのあと動く (その間に「行かない」を選べる)
  - あとから開いた人: すぐ場所に入る。読み込み時のカメラを `viewport:claimed` (優先度 50) で取る
  - ディープリンクで開いた人 (`startAway`)、発表中・運転中などカメラを動かせない人 (`canAutoMove`): 動かさず「離れた」状態にする。ホストの UI から入れる
- **参加を確かめる** (`confirmJoin`): カウントダウンの代わりに、主催者以外は「参加しますか」と聞かれた状態 (`invited`) から始まる。`accept()` で参加し、`enterDelayMs` だけ待ってから動く (ホストが演出を流してから動かすため)。`leave()` は「あとで」
- **参加者**: 参加すると session の `join` を送る。`getState().participants` に、主催者と参加した順に並ぶ
- **終わり**: 主催者が終える、時間の制限が来る (主催者の端末が終える)、または 3 時間の安全弁。
  終わると全員のとどめが外れ、`onEnded` が呼ばれる

## 使い方

```ts
// サーバー (apps/server)
import { gatherServerType } from "@edv4h/usketch-session-gather/server";
new SessionManager({ /* deps */, types: [votingServerType, gatherServerType] });
```

```ts
// クライアント: ボードを開くたびに 1 回作る (ページを移ってアプリを作り直しても、離れた・数え終えたは残る)
import { createGatherClientType, getGatherApi } from "@edv4h/usketch-session-gather/client";

const gatherType = createGatherClientType({
	getViewportSize: () => canvasSize(),
	canAutoMove: () => !presenting,
	startAway: () => openedByDeepLink,
	getPageId: () => currentPageId,
	switchPage: (id) => pages.switchPage(id),
	onEnded: ({ byMe, timedOut }) => toast(timedOut ? "時間になりました" : "集合が終わりました"),
});
createSessionPlugin({ client, userId, types: [gatherType] });

// ホストの UI
const gather = getGatherApi(app.services);
const target = gather?.resolveTarget("selection");
if (target) gather?.start({ hold: "stay", target, hostName: me.name, durationMinutes: 10 });
gather?.subscribe(() => render(gather.getState()));
```

ホストは前提として、`canAutoMove` が変わったとき・ページが変わったときに `refresh()` を呼ぶ。

## 主な export

| entry | export | 内容 |
|---|---|---|
| `/server` | `gatherServerType` | `ServerSessionType`。状態は作るときの config だけで、操作は無い |
| `/client` | `createGatherClientType(options)` | `ClientSessionType`。HUD のカードは持たず、`attach` でカメラを動かす |
| `/client` | `getGatherApi(services)` / `GatherApi` | ホストが UI を描く口 (`getState` / `subscribe` / `start` / `end` / `leave` / `rejoin` / `refresh` / `resolveTarget`) |
| `/client` | `stayInRectConstraint` / `fitViewport` / `visibleWorldRect` | カメラの計算 (純関数) |
| `/client` | `parseGather` / `createGatherConfig` / `initialParticipation` ほか | 状態の読み書きと判断 (純関数) |
| 両方 | `GatherPublic` / `GatherConfig` / `GatherTarget` / `GatherHold` | 公開状態・作成 config |
