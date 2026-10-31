---
"@edv4h/usketch-plugin-avatar": minor
---

feat(avatar): `hideAvatar` オプションを追加。awareness 状態に対して true の間はそのクライアントのアバター（自分を含む）を表示しない（例: 操作キャラ表示中は重ねない）。あわせて `viewportCenter` の awareness 送信を ~20Hz に間引き、キャラ追従などでビューポートが毎フレーム動いても全クライアントの awareness 処理と通信が毎フレーム走らないようにした
