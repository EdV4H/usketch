---
"@edv4h/usketch-plugin-presence-enhanced": patch
---

カーソル移動など既存参加者の awareness 更新ではメンバー一覧（`/api/boards/:id/members`）を再取得しないようにした。参加者の増減時と 30 秒ごとのポーリングでは従来どおり再取得する。
