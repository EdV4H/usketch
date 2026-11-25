---
"@edv4h/usketch-plugin-server-boards": minor
---

ログインしていない人が公開ボードを見るための WebSocket `GET /public/boards/:boardId/ws` を足した。公開ボードだけにつなぎ、役割の無い閲覧者（`userId=anonymous`）として DO へ渡す。
