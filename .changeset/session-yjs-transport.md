---
"@edv4h/usketch-plugin-session": minor
"@edv4h/usketch-session-protocol": minor
"@edv4h/usketch-session-voting": patch
---

セッションを、セッションサーバーの無いボードでも動かせるようにしました。Yjs で同期するボード (y-websocket のホスト・ローカルのボード) でも、同じセッションの型が全員の端末で動きます。

- plugin-session: `createYjsSessionClient({ doc, userId, types, presence? })`。セッションを共有ドキュメントに追記型のログとして置き、各端末が型の `reduce` でたたみ込むので、同時の操作も上書きし合いません。サーバーが無いので `secret` は隠せません
- plugin-session: `createSessionPlugin({ client })` で任意の転送を渡せます (ホストが持ち、プラグインは破棄しない)
- plugin-session: `getSessionApi(services)`。HUD を描かないホストが自分の UI からセッションを作る・操作する口
- plugin-session: `ClientSessionType.attach(ctx)`。型が状態に合わせて副作用 (カメラを動かすなど) を持てます。`renderCard` / `renderCreateForm` は省けるようになり、省いた型は HUD パネルに出ません
- session-protocol: `ServerSessionType.requiresServer(config)`。サーバーでしか動かせない型 (秘密の投票など) を示し、Yjs の転送では作れません
- session-voting: 秘密の投票は `requiresServer` で Yjs の転送では作れないようにしました
