---
"@edv4h/usketch-plugin-server-boards": minor
---

ボード履歴 API（`/api/boards/:boardId/history`、`/history/*`）のプロキシを追加。あわせて、snapshot / history の Durable Object プロキシでボードのアクセス権を確認するようにした（メンバーか公開ボードなら読める、viewer は書き込み不可）。これまでは認証だけで、メンバーでないユーザーも他人のボードのスナップショットを読めた。userId はサーバー側で付け直す。
