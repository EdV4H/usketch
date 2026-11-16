---
"@edv4h/usketch-session-protocol": minor
"@edv4h/usketch-plugin-session": minor
---

主催者の引き継ぎ (`claimHost`) を足した。主催者がいないあいだ (サーバーは接続が切れている、Yjs の転送は `presence` にいない) だけ、ほかの人が主催者になれる。前の主催者は戻ってきても参加者のまま。Yjs の転送では、主催者が `presence` から消えて `hostAwayMs` (既定 10 秒) たってから通し、ログに `host` の行を足す。同時に押したら先の人が主催者になる。主催者が離れるときは、いまいる人のうちいちばん早く入った人を跡継ぎとしてログに書く。カードの `ctx.claimHost()` も足した。
