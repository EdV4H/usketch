---
"@edv4h/usketch-session-protocol": minor
"@edv4h/usketch-plugin-session": minor
---

主催者の引き継ぎ (`claimHost`) を足した。主催者がいないあいだ (サーバーは接続が切れている、Yjs の転送は `presence` にいない) だけ、ほかの人が主催者になれる。前の主催者は戻ってきても参加者のまま。Yjs の転送ではログに `host` の行を足し、同時に押したらログの順で後の人が主催者になる。
