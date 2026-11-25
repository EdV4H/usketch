---
"@edv4h/usketch-plugin-server-boards": major
"@edv4h/usketch-plugin-board-info-panel": minor
"@edv4h/usketch-plugin-shape-board-portal": minor
---

デモの地域（ワールドマップ）をデモボードのページにした（#1558 R6）。

- server-boards: **破壊的変更**。ワールドマップの地域の API（`GET /api/community-boards`・`GET /api/community-boards/:slug`）と、地域のボードを作る処理を削除した。`community_boards` 表（ログインした人を編集者にするボードの印）はこれまでどおり使う。
- shape-board-portal: ゲートのデータに `pageId`（このボードのページへ行くゲート）を足した。
- board-info-panel: 選んだゲートに `pageId` があれば、`onOpenBoard(boardId, pageId)` で渡す。
